# OpenClaw adapter claimedApiKeyPath fix

## Root cause

The Paperclip OpenClaw gateway adapter had two related problems:

1. It sent a top-level `paperclip` field in outbound OpenClaw `agent` params.
   OpenClaw rejects unsupported root-level params, so this caused schema failure.
2. It ignored the configured `claimedApiKeyPath` and effectively relied on the
   global claimed key file path instead.

That mattered because Builder hardening needed to authenticate back into
Paperclip as `builder-hardening`, not as another operator identity that happened
to own the global claimed key file.

## Changed source file

- `packages/adapters/openclaw-gateway/src/server/execute.ts`

## Local commit

- `4af43314`
- `fix(openclaw): honor claimedApiKeyPath and strip unsupported payload metadata`

## Push status

This local source fix was committed, but push was blocked by GitHub permissions
against `paperclipai/paperclip` from this machine/account.

## Why `claimedApiKeyPath` matters

OpenClaw wake instructions need to tell the receiving agent which claimed
Paperclip API key file to load for callback authentication. If every run falls
back to the same global claimed key file, agent identity can leak across
operators or companies.

For Builder hardening, that caused `builder-hardening` work to authenticate as
`OpenClaw Gateway 2` until the per-agent key path was honored.

## Why top-level `paperclip` cannot be sent to OpenClaw

OpenClaw's `agent` params schema is strict at the root. Unsupported metadata at
that level is rejected. Paperclip context must stay inside the rendered message
or other supported fields, not as an extra root-level `paperclip` property.

## Upstream action still needed

An upstream PR/release is still needed so this fix stops living only as:

- a local source commit, and
- a machine-specific `npx` repatch/startup workaround.
