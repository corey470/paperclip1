# Paperclip Hostinger migration

Status: staged on Hostinger, ready for final sync after the shared OpenClaw gateway moves.

## Source truth

- GitHub application repo: `corey470/paperclip1`, default branch `master`.
- GitHub `master` at verification: `524e18b060e4d15bd5e5a67799f3ee8c5f837919`.
- DigitalOcean source: `/opt/irie/apps/paperclip/src` and `/opt/irie/staging/paperclip/src`.
- Both DigitalOcean source trees match each other. They contain 1,652 hashed files and have source-manifest SHA-256 `8fa51be44cc64931715b2bc1b5caf6f7f10a94db87c139b62ff0cc7520c57e52`.
- The deployed source matched the older local runtime checkout at `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip`, including its working-tree changes.
- Migration branch: `codex/paperclip-hostinger-20260828`.
- Commit `621dadf4` captures the exact deployed application changes before this documentation commit.

## Staged destinations

| Lane | App | Database | Data volume |
| --- | --- | --- | --- |
| Production | Hostinger `/opt/irie/apps/paperclip`, `127.0.0.1:3100` | `paperclip-production-db-1`, `127.0.0.1:54337` | `paperclip-production_paperclip-data` |
| Staging | Hostinger `/opt/irie/staging/paperclip`, `127.0.0.1:13100` | `paperclip-staging-db-1`, `127.0.0.1:54338` | `paperclip-staging_paperclip-data` |

Both Hostinger servers run with `HEARTBEAT_SCHEDULER_ENABLED=false`. This prevents the staged copies from invoking agents or changing issue state while DigitalOcean remains live.

## DigitalOcean posture

DigitalOcean remains the live source of writes. The production and staging app/database containers remain up. No Cloudflare hostname points to either runtime. Production is private on the DigitalOcean tailnet at `100.108.181.40:3100`; staging is loopback-only at `127.0.0.1:13100`.

The final cutover must freeze the two Paperclip server containers before the shared OpenClaw gateway stops. Start the Hostinger gateway before enabling either Hostinger Paperclip scheduler.

## Validation

- `pnpm -r typecheck`: passed.
- `pnpm build`: passed.
- Docker image build: passed for both Hostinger lanes.
- `pnpm test:run`: 1,562 passed, 1 skipped, 6 failed. Four failures cover the recovered uncommitted OpenClaw wake-payload change. Two tests saw the Mac's real Tailscale address instead of their mocked loopback fallback.
- Browser: production and staging on both hosts rendered the same Paperclip sign-in controls through SSH tunnels.
- API/auth: ten rounds on each host and lane returned `200` for health and root, `403` for anonymous companies, and `401` for anonymous session lookup.
- Database: both Hostinger databases matched their DigitalOcean snapshot schema, row counts, and core fingerprints.
- Owned files: production matched 177 files and staging matched 173 files. Each server appended to its own `server.log` after boot; no other file changed.
- Hostinger backup and scratch restore drills passed for both lanes.

## Dependency audit

The deployed lockfile reports 2 critical and 48 high production findings. Better Auth, Drizzle, Hono, and several transitive packages need patched versions. The required Better Auth and ORM upgrades cross direct runtime boundaries, and GitHub `master` still pins Better Auth `1.4.18`. This migration does not mix those upgrades into the infrastructure cutover. Keep the runtime private and schedule a separate dependency upgrade with authenticated browser regression tests.

## Untouched local work

The migration used isolated worktrees. These original paths remain untouched:

- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip`: modified `README.md`; modified `packages/adapters/openclaw-gateway/src/server/execute.ts`; untracked `scripts/paperclip-bridge.ts`; untracked `.codegraph/`.
- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip-irie-config`: modified `.codegraph/.gitignore`.
- `/Users/irieagent/Documents/paperclip`: untracked `.codegraph/` and `.mcp.json` on `codex/irie-openclaw-result-only`.

The isolated migration branch commits the deployed application changes so the next operator can review them without altering the original worktrees.

## Cutover blocker

All active OpenClaw adapter configurations use `ws://127.0.0.1:18789/`. DigitalOcean runs `irie-openclaw-gateway.service` on that port. Hostinger does not have that gateway yet. Paperclip cannot execute agents from Hostinger until the gateway migration restores the same local endpoint and validates its state.

The Irie deployment files and full cutover runbook live in `corey470/paperclip-irie-config` on branch `codex/paperclip-hostinger-20260828`.
