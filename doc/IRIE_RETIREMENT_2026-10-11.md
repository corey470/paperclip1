# Irie Paperclip retirement — 2026-10-11

Corey directed the Irie Paperclip deployment and its configuration to be archived and shut down. This fork is preserved as source history; the upstream Paperclip project is separate.

- Mac Paperclip, health check, backup, port-forward, and staging tunnel LaunchAgents are disabled and stopped. The Mac server port 3100 is closed.
- Hostinger `paperclip-production` and `paperclip-staging` Compose projects are down. At Corey's subsequent direction, their four named Docker volumes, images, backup directories, source trees, temporary files, and systemd unit definitions were removed on 2026-10-11.
- Final Mac PostgreSQL dump: `~/.paperclip/instances/default/backups/paperclip-retirement-20261011T120645Z.dump`. Final Mac instance archive: `~/Library/Application Support/Irie/retired-paperclip-tower/backups/paperclip-mac-instance-2026-10-11.tar.gz`.
- The final Hostinger production and staging backup packets passed checksums and database archive listings before Corey directed their deletion. They are no longer restore locations. Hostinger disk usage fell from about 151 GB to 124 GB after the dedicated cleanup and unused Docker build cache pruning.
- The Mac source checkout has local commits and uncommitted changes that were left intact. Patch snapshots are stored at `~/Library/Application Support/Irie/retired-paperclip-tower/source-snapshots/`.
- Irie OS marks `paperclip-core` and `paperclip-irie-config` retired and omits Paperclip from active health probes. The configuration repository retains the historical operating manifest and paused tracker definitions.

The older [Irie production pointer](IRIE_PRODUCTION_POINTER_2026-08-28.md) describes the former deployment and is no longer a restart instruction. Reopening Paperclip requires a fresh runtime and data review and Corey's direction.
