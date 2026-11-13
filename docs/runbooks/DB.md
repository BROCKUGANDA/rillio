# Runbook: Database

## Health
- `npx prisma migrate status` — must report "Database schema is up to date!".
- `npx prisma db execute --stdin` for ad-hoc SQL (never run destructive ops without consent).

## Backup (PostgreSQL)
- `pg_dump -Fc -U rillio -h 127.0.0.1 -p 5433 rillio > rillio-$(date +%F).dump`
- Store encrypted; test restore quarterly.

## Restore
- `pg_restore -U rillio -h 127.0.0.1 -p 5433 -d rillio rillio-YYYY-MM-DD.dump`
- Re-run `npx prisma migrate deploy` after restore to catch drift.

## Migration discipline
- Never edit applied migrations; add new ones.
- Expand/migrate/contract for breaking changes.
- `prisma migrate reset` only on dev DBs (destroys data).

## On-call checks
- Connection pool saturation, slow queries > 400ms, lock waits.
