# Irie Paperclip retirement — 2026-10-11

Corey directed the Irie Paperclip deployment and its configuration to be archived and shut down. This fork is preserved as source history; the upstream Paperclip project is separate.

- Mac Paperclip, health check, backup, port-forward, and staging tunnel LaunchAgents are disabled and stopped. The Mac server port 3100 is closed.
- Hostinger `paperclip-production` and `paperclip-staging` Compose projects are down. Their four named Docker volumes remain; the backup timers and production tailnet socket are disabled.
- Final Mac PostgreSQL dump: `~/.paperclip/instances/default/backups/paperclip-retirement-20261011T120645Z.dump`. Final Mac instance archive: `~/Library/Application Support/Irie/retired-paperclip-tower/backups/paperclip-mac-instance-2026-10-11.tar.gz`.
- Final Hostinger production and staging backup packets: `/opt/irie/backups/paperclip-production/20261011T120650Z` and `/opt/irie/backups/paperclip-staging/20261011T120659Z`. Packet checksums and database archive listings passed.
- The Mac source checkout has local commits and uncommitted changes that were left intact. Patch snapshots are stored at `~/Library/Application Support/Irie/retired-paperclip-tower/source-snapshots/`.
- Irie OS marks `paperclip-core` and `paperclip-irie-config` retired and omits Paperclip from active health probes. The configuration repository retains the historical operating manifest and paused tracker definitions.

The older [Irie production pointer](IRIE_PRODUCTION_POINTER_2026-08-28.md) describes the former deployment and is no longer a restart instruction. Reopening Paperclip requires a fresh runtime and data review and Corey's direction.
