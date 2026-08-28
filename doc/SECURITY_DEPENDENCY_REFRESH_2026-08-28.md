# Paperclip dependency security refresh

Status: review branch only. Nothing in this branch has been deployed to DigitalOcean or Hostinger.

## Source boundary

- GitHub repo: `corey470/paperclip1`.
- Branch: `codex/paperclip-security-20260828`.
- Base commit: `478b72e6a314c6f9f1598fe9078ae180ddb7e5c0`, the completed Hostinger migration-documentation commit.
- Deployed-source capture: `621dadf4`, including the recovered OpenClaw wake-payload change and bridge script.
- DigitalOcean and Hostinger runtime state was not changed during this work.

This branch deliberately starts from the deployed-source migration branch, not from GitHub `master`. It does not alter the migration snapshot, schema files, application data, secrets, schedulers, tunnel, DNS, or OpenClaw gateway.

## Audit result

The production audit began at 2 critical and 48 high findings. The full workspace audit began at 3 critical and 54 high findings.

After the refresh:

| Audit | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| `pnpm audit --prod` | 0 | 0 | 12 | 7 |
| `pnpm audit` | 0 | 0 | 12 | 8 |

Both `pnpm audit --prod --audit-level=high` and `pnpm audit --audit-level=high` exit successfully.

The original critical findings were Better Auth OAuth refresh-token replay and Vitest UI arbitrary file read/execution. The high findings covered direct runtime packages and their dependency trees.

## Direct package changes

| Package | Before | After | Boundary covered |
| --- | --- | --- | --- |
| `better-auth` | `1.4.18` | `1.6.22` | Authentication and OAuth advisories |
| `drizzle-orm` | `0.38.4` | `0.45.2` | Identifier escaping and Kysely chain |
| `multer` | `2.1.1` | `2.2.0` | Multipart nested-field denial of service |
| `sharp` | `0.34.5` | `0.35.4` | Patched libvips bundle |
| `ws` | `8.19.0` | `8.21.0` | Fragment-based memory exhaustion |
| `react-router-dom` | resolved `7.13.0` | `7.18.2` | React Router RCE, XSS, CSRF, and denial-of-service advisories |
| `mermaid` | resolved `11.12.3` | `11.16.1` | Vulnerable `lodash-es` dependency chain |
| `vite` | resolved `6.4.1` | `6.4.3` | File-read and path-deny bypass advisories |
| `vitest` | resolved `3.2.4` | `3.2.6` | Critical Vitest UI advisory |

The `vitest` change is applied consistently across the workspace packages that declare it. Drizzle is likewise aligned across CLI, server, and database packages.

## Transitive pins

The root lock policy pins patched releases for `@hono/node-server`, `fast-uri`, `fast-xml-parser`, `form-data`, `hono`, `ip-address`, `js-yaml`, Nano ID 5, `path-to-regexp`, `picomatch`, and `undici`. The existing Rollup override remains in place. These pins cover dependency paths reached through the AWS SDK, AJV, MCP SDK, Express router, JSDOM, Mermaid, and the test toolchain.

No force install or dependency major-version jump was used.

This deploy-review branch includes the resolved lockfile so a staged image can be reproduced exactly. The repo's pull-request policy normally leaves `pnpm-lock.yaml` to GitHub Actions. If this work becomes a pull request, follow that policy and let CI regenerate the lockfile from the reviewed manifests.

## Compatibility changes

- Better Auth now returns its precise inferred instance type. The handler and session helpers consume that exact type instead of the broader generic return type that Better Auth 1.6 rejects.
- Sharp 0.35 supplies its own corrected ESM and CommonJS declarations. The deprecated `@types/sharp` stub was removed.
- No database migration, route, or data-model source was changed.

## Verification

- `pnpm -r typecheck`: passed for every workspace package. The database migration-numbering check ran as part of this command.
- `pnpm build`: passed, including server, CLI, UI, adapters, database package, MCP package, and plugin examples.
- `pnpm test:run`: 1,562 passed, 1 skipped, 6 failed across 287 files. This is the exact deployed-source baseline: four failures expect the pre-change OpenClaw wake payload, and two tests detect the Mac's real Tailscale address instead of their mocked fallback.
- Database contracts: the database client migration suite passed all 7 tests; backup/restore library tests passed all 3 tests.
- Fresh-runtime migration: a disposable embedded PostgreSQL instance applied all 58 migrations and restarted with no pending migrations.
- Auth integration: on the disposable authenticated loopback runtime, email sign-up returned 200, issued a session cookie, and session lookup returned 200 for the same user.
- API: disposable runtime root and health returned 200. Authenticated mode returned the expected 403/401 results before sign-in.
- Browser: the application rendered the Paperclip onboarding UI from the disposable loopback runtime.

The disposable runtimes and databases were stopped and moved to Trash after verification. No persistent local service was left listening.

## Remaining findings and review notes

The remaining production findings are 12 moderate and 7 low. They are primarily DOMPurify 3.3.2, transitive esbuild, `qs`, and `body-parser`. One low advisory is a package-name collision against this workspace's private `cli` package. They are outside the requested critical/high lane and were not expanded into a second dependency sweep.

`better-call` 1.3.7 reports a peer warning for Zod 4 while Paperclip still uses Zod 3.25.76. A Zod major upgrade was not forced. The fresh authenticated runtime, sign-up, cookie, and session checks passed, but the peer warning remains a review item.

The six existing test failures must not be attributed to this refresh. They are preserved behavior from the exact deployed source and should be repaired separately with the OpenClaw bridge work and a hermetic Tailscale mock.

## Cutover use

This branch is a candidate application source, not an automatic replacement for the already staged images. Before using it at cutover:

1. Review this branch against `478b72e6`.
2. Rebuild both Hostinger Paperclip images from the approved security commit while schedulers remain disabled.
3. Repeat Hostinger production/staging health, anonymous auth, browser, and database migration checks.
4. Keep the serialized dependency order: freeze DigitalOcean Paperclip writers, final-sync and stop the DigitalOcean OpenClaw gateway, start and verify the Hostinger gateway, restore the final Paperclip snapshot, then enable Hostinger Paperclip schedulers.

If the branch is not approved, keep the existing staged images at migration commit `478b72e6`. Do not mix the lockfile from this branch with that older image.

Rollback for this branch is source-only: redeploy the known staged image built from `478b72e6`. Database rollback still requires the migration runbook's reverse-sync rule once Hostinger has accepted writes.
