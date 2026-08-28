#!/usr/bin/env -S node --import tsx

import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUTBOX_URL =
  process.env.APPROVALS_OUTBOX_URL ??
  "https://povyxvsxnudcnemltbrg.supabase.co/functions/v1/approvals-outbox?status=PENDING";
const DECISION_URL =
  process.env.APPROVALS_DECISION_URL ??
  "https://povyxvsxnudcnemltbrg.supabase.co/functions/v1/approvals-decision";
const PAPERCLIP_BASE_URL = process.env.PAPERCLIP_BASE_URL ?? "http://192.168.1.244:3100";
const PAPERCLIP_COMPANY_ID =
  process.env.PAPERCLIP_COMPANY_ID ?? "6ca3df64-9a54-41ee-9329-993fc21ed090";
const PAPERCLIP_AGENT_ID =
  process.env.PAPERCLIP_AGENT_ID ?? "0ae619bf-399d-4741-aedf-b7273ec99d5a";
const CALLBACK_PORT = Number(process.env.PAPERCLIP_BRIDGE_PORT ?? "4101");
const POLL_INTERVAL_MS = Number(process.env.PAPERCLIP_BRIDGE_POLL_INTERVAL_MS ?? "30000");
const STATE_PATH =
  process.env.PAPERCLIP_BRIDGE_STATE_PATH ?? path.join(os.homedir(), ".paperclip-bridge-state.json");
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;

type FastifyApprovalRequest = {
  id: string;
  status?: string;
  agentName?: string | null;
  action?: string | null;
  resource?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  amountUsd?: number | string | null;
  riskLevel?: string | null;
  metadata?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  policy?: Record<string, unknown> | null;
};

type PaperclipApproval = {
  id: string;
  status?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  payload?: Record<string, unknown> | null;
};

type MirroredApproval = {
  paperclipApprovalId: string | null;
  mirroredAt: string;
  lastSeenStatus: string;
  resolvedAt?: string;
};

type BridgeState = {
  mirrored: Record<string, MirroredApproval>;
};

const defaultState = (): BridgeState => ({ mirrored: {} });

function log(message: string, extra?: Record<string, unknown>) {
  const prefix = `[paperclip-bridge ${new Date().toISOString()}]`;
  if (extra) {
    console.log(prefix, message, JSON.stringify(extra));
    return;
  }
  console.log(prefix, message);
}

async function ensureStateDir() {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
}

async function loadState(): Promise<BridgeState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BridgeState>;
    return {
      mirrored: parsed.mirrored ?? {},
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      log("failed to read state file, starting with empty state", { error: err.message });
    }
    return defaultState();
  }
}

async function saveState(state: BridgeState) {
  await ensureStateDir();
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return (text ? JSON.parse(text) : null) as T;
}

function normalizeOutboxResponse(payload: unknown): FastifyApprovalRequest[] {
  if (Array.isArray(payload)) {
    return payload as FastifyApprovalRequest[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.approvals)) {
      return record.approvals as FastifyApprovalRequest[];
    }
    if (Array.isArray(record.approvalRequests)) {
      return record.approvalRequests as FastifyApprovalRequest[];
    }
    if (Array.isArray(record.requests)) {
      return record.requests as FastifyApprovalRequest[];
    }
    if (Array.isArray(record.data)) {
      return record.data as FastifyApprovalRequest[];
    }
  }

  return [];
}

function buildPaperclipPayload(approval: FastifyApprovalRequest) {
  return {
    type: "request_board_approval",
    requestedByAgentId: PAPERCLIP_AGENT_ID,
    payload: {
      source: "irie-suite",
      approvalRequestId: approval.id,
      agentName: approval.agentName ?? null,
      status: approval.status ?? "PENDING",
      action: approval.action ?? null,
      resource: approval.resource ?? null,
      resourceId: approval.resourceId ?? null,
      reason: approval.reason ?? null,
      amountUsd: approval.amountUsd ?? null,
      riskLevel: approval.riskLevel ?? null,
      metadata: approval.metadata ?? null,
      context: approval.context ?? null,
      policy: approval.policy ?? null,
      createdAt: approval.createdAt ?? null,
      updatedAt: approval.updatedAt ?? null,
      expiresAt: approval.expiresAt ?? null,
    },
  };
}

function extractPaperclipApprovalId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") {
    return record.id;
  }

  if (record.approval && typeof record.approval === "object" && record.approval) {
    const approval = record.approval as Record<string, unknown>;
    if (typeof approval.id === "string") {
      return approval.id;
    }
  }

  return null;
}

async function mirrorApproval(approval: FastifyApprovalRequest, state: BridgeState) {
  if (!PAPERCLIP_API_KEY) {
    throw new Error("PAPERCLIP_API_KEY is required");
  }

  const response = await fetchJson<unknown>(
    `${PAPERCLIP_BASE_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/approvals`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${PAPERCLIP_API_KEY}`,
      },
      body: JSON.stringify(buildPaperclipPayload(approval)),
    }
  );

  state.mirrored[approval.id] = {
    paperclipApprovalId: extractPaperclipApprovalId(response),
    mirroredAt: new Date().toISOString(),
    lastSeenStatus: approval.status ?? "PENDING",
  };
  await saveState(state);
}

async function pollOutbox(state: BridgeState) {
  const approvals = normalizeOutboxResponse(await fetchJson<unknown>(OUTBOX_URL));
  const pendingIds = new Set<string>();
  let mirroredNow = 0;

  for (const approval of approvals) {
    if (!approval.id) {
      continue;
    }

    pendingIds.add(approval.id);

    const existing = state.mirrored[approval.id];
    if (!existing) {
      await mirrorApproval(approval, state);
      mirroredNow += 1;
      continue;
    }

    existing.lastSeenStatus = approval.status ?? existing.lastSeenStatus;
  }

  for (const [approvalRequestId, mirrored] of Object.entries(state.mirrored)) {
    if (!pendingIds.has(approvalRequestId) && !mirrored.resolvedAt) {
      mirrored.resolvedAt = new Date().toISOString();
    }
  }

  await saveState(state);
  if (mirroredNow > 0) {
    log(`Mirrored ${mirroredNow} approvals`, {
      pending: approvals.length,
      totalMirrored: Object.keys(state.mirrored).length,
    });
  }
  log("poll complete", {
    pending: approvals.length,
    mirrored: Object.keys(state.mirrored).length,
  });
}

function extractSourceApprovalId(payload: Record<string, unknown> | null | undefined) {
  return typeof payload?.approvalRequestId === "string" ? payload.approvalRequestId : null;
}

function isBridgeApproval(payload: Record<string, unknown> | null | undefined) {
  const source = payload?.source;
  return source === "irie-suite" || source === "suite-approvals-outbox";
}

async function fetchPaperclipApprovals() {
  if (!PAPERCLIP_API_KEY) {
    throw new Error("PAPERCLIP_API_KEY is required");
  }

  return fetchJson<PaperclipApproval[]>(
    `${PAPERCLIP_BASE_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/approvals`,
    {
      headers: {
        authorization: `Bearer ${PAPERCLIP_API_KEY}`,
      },
    }
  );
}

async function forwardDecisionToSuite(
  payload: {
    approvalRequestId: string;
    decision: "APPROVE" | "REJECT";
    approverName: string;
    approverEmail: string;
    note?: string;
    metadata: Record<string, unknown>;
  },
  state: BridgeState
) {
  await fetchJson<unknown>(DECISION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const mirrored = state.mirrored[payload.approvalRequestId];
  if (mirrored) {
    mirrored.lastSeenStatus = payload.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    mirrored.resolvedAt = new Date().toISOString();
    await saveState(state);
  }
}

async function pollResolvedApprovals(state: BridgeState) {
  const approvals = await fetchPaperclipApprovals();
  let resolvedNow = 0;

  for (const approval of approvals) {
    const payload =
      approval.payload && typeof approval.payload === "object"
        ? (approval.payload as Record<string, unknown>)
        : null;
    if (!isBridgeApproval(payload)) {
      continue;
    }

    const sourceApprovalRequestId = extractSourceApprovalId(payload);
    if (!sourceApprovalRequestId) {
      continue;
    }

    const mirrored = state.mirrored[sourceApprovalRequestId];
    if (!mirrored) {
      continue;
    }

    if (mirrored.lastSeenStatus !== "PENDING") {
      continue;
    }

    if (approval.status !== "approved" && approval.status !== "rejected") {
      continue;
    }

    await forwardDecisionToSuite(
      {
        approvalRequestId: sourceApprovalRequestId,
        decision: approval.status === "approved" ? "APPROVE" : "REJECT",
        approverName: "Corey Steward",
        approverEmail: "corey@irieswag.com",
        note: approval.decisionNote ?? undefined,
        metadata: {
          paperclipApprovalId: approval.id,
          resolvedAt: approval.decidedAt ?? new Date().toISOString(),
        },
      },
      state
    );

    resolvedNow += 1;
    log("resolved approval forwarded to Suite", {
      sourceApprovalRequestId,
      paperclipApprovalId: approval.id,
      decision: approval.status,
    });
  }

  if (resolvedNow > 0) {
    log(`Forwarded ${resolvedNow} resolved approvals`, {
      mirrored: Object.keys(state.mirrored).length,
    });
  }
}

async function main() {
  const state = await loadState();
  let pollInFlight = false;

  const runPoll = async () => {
    if (pollInFlight) {
      return;
    }

    pollInFlight = true;
    try {
      await pollOutbox(state);
      await pollResolvedApprovals(state);
    } catch (error) {
      const err = error as Error;
      log("poll failed", { error: err.message });
    } finally {
      pollInFlight = false;
    }
  };

  await runPoll();
  const timer = setInterval(runPoll, POLL_INTERVAL_MS);

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/paperclip-callback") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "Paperclip has no outbound webhooks; resolution polling is active." }));
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
      const err = error as Error;
      log("callback handler failed", { error: err.message });
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(CALLBACK_PORT, () => {
    log("bridge listening", {
      callbackPort: CALLBACK_PORT,
      outboxUrl: OUTBOX_URL,
      decisionUrl: DECISION_URL,
      paperclipBaseUrl: PAPERCLIP_BASE_URL,
      paperclipAgentId: PAPERCLIP_AGENT_ID,
      statePath: STATE_PATH,
    });
  });

  const shutdown = async () => {
    clearInterval(timer);
    server.close(() => {
      log("bridge stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main();
