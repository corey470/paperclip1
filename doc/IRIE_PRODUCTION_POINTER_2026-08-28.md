# Irie Paperclip production pointer

Status: Irie Paperclip production and staging run on Hostinger. DigitalOcean is stopped and retained for rollback.

## Deployed source

This note starts from GitHub `master` commit `524e18b060e4d15bd5e5a67799f3ee8c5f837919`. The live Irie image does not come from this `master` history.

- Live image source branch: `codex/paperclip-security-20260828`
- Live application commit: `609cc3ee3a8474d2ca2fa97d42987fd1eb013ed9`
- Deployed-source capture: `621dadf4`
- Migration record branch: `codex/paperclip-hostinger-20260828`
- Irie deployment repo: `corey470/paperclip-irie-config`, branch `codex/paperclip-hostinger-20260828`

The deployed-source and security branches split from `master` 260 commits before this note. Do not merge them into `master` or deploy current `master` as a replacement without a reviewed application integration and a fresh migration test.

## Hostinger runtime

- Production app: `/opt/irie/apps/paperclip`, loopback `127.0.0.1:3100`
- Production private address: `100.123.61.117:3100` through `paperclip-production-tailnet.socket`
- Production database: `paperclip-production-db-1`, loopback `127.0.0.1:54337`
- Staging app: `/opt/irie/staging/paperclip`, loopback `127.0.0.1:13100`
- Staging database: `paperclip-staging-db-1`, loopback `127.0.0.1:54338`

Both app containers run security image `609cc3ee`. Both heartbeat schedulers are enabled. Hostinger keeps `PAPERCLIP_ALLOWED_HOSTNAMES` and `BETTER_AUTH_TRUSTED_ORIGINS` in root-owned env files for the private tailnet origin. Do not commit their values.

## Validation and recovery

- Final DigitalOcean snapshot: `/opt/irie/backups/paperclip-pair/cutover-20260828T212720Z`
- Hostinger production backup: `/opt/irie/backups/paperclip-production/20260828T213536Z`; restore drill passed
- Hostinger staging backup: `/opt/irie/backups/paperclip-staging/20260828T213543Z`; restore drill passed
- Ten route and authentication rounds passed after cutover
- Anonymous session check: `/api/auth/get-session` returns `401`; `/api/auth/session` returns `404` on the live version
- Production tailnet check passed at `100.123.61.117:3100`
- Production and full dependency audits report zero critical and zero high findings

Disable `paperclip-production-tailnet.socket` before recreating the production app container. Confirm the app is healthy on `127.0.0.1:3100`, then enable the socket. A recreation performed with the socket active caused Paperclip to select port `3101`; the operator corrected it with this order.

## DigitalOcean and rollback

The production app, production database, staging app, and staging database containers on DigitalOcean have restart policy `no` and remain exited. DigitalOcean keeps the source trees, volumes, secrets, and final snapshot.

DigitalOcean data became stale after Hostinger accepted writes. Stop Hostinger writers and reverse-sync both databases and owned data volumes before starting any old database. Move OpenClaw and Paperclip in the order recorded on the migration branches.

## Untouched local work

- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip`: modified `README.md`; modified `packages/adapters/openclaw-gateway/src/server/execute.ts`; untracked `.codegraph/`; untracked `scripts/paperclip-bridge.ts`.
- `/Users/irieagent/Documents/paper-clip-Irie-commerce/paperclip-irie-config`: modified `.codegraph/.gitignore`.
- `/Users/irieagent/Documents/paperclip`: untracked `.codegraph/` and `.mcp.json`.

The migration used isolated worktrees. It did not edit the paths above.
