# Paperclip Hostinger migration

Status: production runs on Hostinger. DigitalOcean is stopped and retained for rollback.

## Source truth

- GitHub application repo: `corey470/paperclip1`, default branch `master`.
- GitHub `master` at the post-cutover documentation pass: `524e18b060e4d15bd5e5a67799f3ee8c5f837919`.
- Live Hostinger image source: security branch `codex/paperclip-security-20260828`, commit `609cc3ee3a8474d2ca2fa97d42987fd1eb013ed9`.
- Deployed-source capture: `621dadf4`. It records the DigitalOcean application tree, including the recovered OpenClaw wake-payload change and `scripts/paperclip-bridge.ts`.
- Migration branch: `codex/paperclip-hostinger-20260828`.

GitHub `master` has 260 commits that do not belong to the deployed-source branch. The migration did not merge those histories. Review and port application changes before replacing the live image.

## Production destinations

| Lane | App | Database | Data volume |
| --- | --- | --- | --- |
| Production | Hostinger `/opt/irie/apps/paperclip`, `127.0.0.1:3100` | `paperclip-production-db-1`, `127.0.0.1:54337` | `paperclip-production_paperclip-data` |
| Staging | Hostinger `/opt/irie/staging/paperclip`, `127.0.0.1:13100` | `paperclip-staging-db-1`, `127.0.0.1:54338` | `paperclip-staging_paperclip-data` |

Both Hostinger servers run image `609cc3ee`. Both heartbeat schedulers are enabled. Production uses `paperclip-production-tailnet.socket` at `100.123.61.117:3100`; staging stays loopback-only.

The Hostinger env files contain two host-specific settings required by the private listener:

- `PAPERCLIP_ALLOWED_HOSTNAMES` permits `100.123.61.117`.
- `BETTER_AUTH_TRUSTED_ORIGINS` trusts the Hostinger tailnet origin.

The env files remain under `/opt/irie/secrets`, owned by root with mode `600`. Do not commit their values.

## DigitalOcean posture

DigitalOcean no longer serves Paperclip. These containers have restart policy `no` and are exited:

- `paperclip-production-server-1`
- `paperclip-production-db-1`
- `paperclip-staging-server-1`
- `paperclip-staging-db-1`

DigitalOcean retains its app trees, volumes, secrets, and the frozen cutover snapshot at `/opt/irie/backups/paperclip-pair/cutover-20260828T212720Z`. That database state became stale after Hostinger accepted writes. Never start the old database containers without reverse-syncing the Hostinger databases and owned data.

## Validation evidence

- Security image: `609cc3ee3a8474d2ca2fa97d42987fd1eb013ed9` remained live after cutover.
- Dependency gates: production and full-workspace audits report zero critical and zero high findings.
- Build and migration checks passed before deployment.
- Final frozen DigitalOcean snapshot: `/opt/irie/backups/paperclip-pair/cutover-20260828T212720Z`.
- Hostinger production backup: `/opt/irie/backups/paperclip-production/20260828T213536Z`; scratch restore passed.
- Hostinger staging backup: `/opt/irie/backups/paperclip-staging/20260828T213543Z`; scratch restore passed.
- Ten route and authentication rounds passed after cutover. Anonymous `/api/auth/get-session` returned `401`; the older `/api/auth/session` shorthand returns `404` on this version.
- Production tailnet access passed at `100.123.61.117:3100`.

The first production recreation ran while the tailnet socket already held port `3100`. Paperclip selected `3101` without data loss. The operator disabled the socket, restarted Paperclip on loopback port `3100`, confirmed health, and enabled the socket again. Future recreations must disable `paperclip-production-tailnet.socket` before replacing the production app container, then re-enable it after the app reports healthy on `127.0.0.1:3100`.

## Dependency posture

The live security image reduced the production audit from 2 critical and 48 high findings to zero critical and zero high. It retains 12 moderate and 7 low findings. The security change and review evidence live in `doc/SECURITY_DEPENDENCY_REFRESH_2026-08-28.md` on `codex/paperclip-security-20260828`.

## Rollback

Stop Hostinger writers first. Disable both heartbeat schedulers, stop both Hostinger Paperclip servers, and disable `paperclip-production-tailnet.socket`. Follow the OpenClaw rollback packet before moving agent execution.

Take fresh Hostinger backups and reverse-sync both databases and both owned data volumes to DigitalOcean. Start DigitalOcean in this order: databases, OpenClaw, Paperclip servers. Restore restart policies after database reconciliation, local health, authentication, and `100.108.181.40:3100` pass.

## Untouched local work

The migration used isolated worktrees. These original paths remain untouched:

- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip`: modified `README.md`; modified `packages/adapters/openclaw-gateway/src/server/execute.ts`; untracked `scripts/paperclip-bridge.ts`; untracked `.codegraph/`.
- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip-irie-config`: modified `.codegraph/.gitignore`.
- `/Users/irieagent/Documents/paperclip`: untracked `.codegraph/` and `.mcp.json` on `codex/irie-openclaw-result-only`.

The Irie deployment files and rollback commands live in `corey470/paperclip-irie-config` on branch `codex/paperclip-hostinger-20260828`.
