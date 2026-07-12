# ADR-001: Use Node's built-in SQLite for the authoritative collaboration store

**Status:** Accepted for A1 implementation  
**Date:** 2026-07-12  
**Approver:** Pending — a named schema/security approver is required before any public server API or schema migration is merged.

## Decision

`@planweave-ai/server` will use `node:sqlite` (`DatabaseSync`) directly, with SQL migrations owned by the server package. The server is the only process permitted to open the authoritative database for writes. It will set WAL mode, foreign keys, and busy timeout on every connection; state-changing application services will use explicit `BEGIN IMMEDIATE` transactions.

This is intentionally separate from the runtime's rebuildable PlanGraph SQLite index. The selected store is durable collaboration state and must never be rebuilt from Plan Package files.

## Spike evidence

On this workspace (Node `v24.14.0`, pnpm `10.32.1`), an ESM-compatible `node:sqlite` smoke check created an in-memory database, executed `BEGIN IMMEDIATE` / `COMMIT`, and read the committed row successfully. The runtime already loads the same API from ESM through `createRequire` in `packages/runtime/src/plangraph/sqlite/connection.ts`.

| Candidate | Node ESM and transactions | Migrations and test isolation | macOS/Linux/Windows and Desktop impact | Decision |
|---|---|---|---|---|
| `node:sqlite` | Available under the project's Node floor (>=22.5); synchronous API fits short, serialized server transactions | SQL migration runner is small and explicit; temp-file database per test | No npm/native addon download or ABI rebuild; server is not bundled into Electron | **Selected** |
| `better-sqlite3` | Mature synchronous transaction API | Requires a separate migration layer; temp files work | Native addon/prebuild or toolchain risk across all targets and Electron ABI if ever packaged | Rejected for first release |
| `@libsql/client` | Adds a client abstraction and optional remote topology | Adds a migration/tooling decision | Extra dependency and a remote/libSQL concern outside the single-LAN-server goal | Rejected for first release |

The non-selected candidates were inspected only through package metadata; no candidate code remains in the repository. The chosen database API is built into Node, so it adds no lockfile dependency. A future server package must verify `pnpm install --frozen-lockfile`, its own typecheck/build, and the SQLite integration suite on macOS, Linux, and Windows CI before release.

## Consequences

- Migrations are numbered, forward-only SQL files with a schema-version table. Downgrade is operational rollback from a verified backup, not automatic destructive migration.
- All database values crossing module boundaries are mapped to typed DTOs; `DatabaseSync` types do not escape `packages/server`.
- The single-writer limit is accepted for the first LAN topology. Instrument lock wait time and reconsider PostgreSQL only if the RFC KPI guardrail is missed for two review windows.

## Rollback

Freeze server writes, retain the database/WAL/audit log, export a verified snapshot, and return clients to local mode. Do not attempt to reconstruct collaboration history from the runtime index or Plan Package files.
