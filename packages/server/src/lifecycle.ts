import { mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import type { ServerConfig } from "./config.js";
import { applyMigrations } from "./migrations.js";
import { openServerDatabase, type SqliteDatabase } from "./sqlite.js";

export type StartupReconciliationHook = (database: SqliteDatabase) => void | Promise<void>;
export type PlanweaveServer = { config: ServerConfig; database: SqliteDatabase; readiness(): { status: "ready"; schemaVersion: number }; backupPath(): string; createBackup(name: string): Promise<string>; createHttpServer(): Server; close(): void };
export async function startPlanweaveServer(config: ServerConfig, reconciliationHooks: readonly StartupReconciliationHook[] = []): Promise<PlanweaveServer> {
  await mkdir(config.dataDirectory, { recursive: true });
  const database = await openServerDatabase(config.databasePath, config.busyTimeoutMs);
  applyMigrations(database);
  for (const hook of reconciliationHooks) await hook(database);
  const backupPath = () => join(config.dataDirectory, "backups");
  return {
    config, database, readiness: () => ({ status: "ready", schemaVersion: 1 }), backupPath,
    createBackup: async (name) => { if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) throw new Error("Backup name must be a safe filename."); const directory = backupPath(); await mkdir(directory, { recursive: true }); const target = join(directory, name); database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`); return target; },
    createHttpServer: () => createServer((request, response) => { const path = new URL(request.url ?? "/", `http://${request.headers.host ?? config.host}`).pathname; if (path === "/healthz" || path === "/readyz") { response.writeHead(200, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify({ ...({ status: "ready", schemaVersion: 1 }), requestId: request.headers["x-request-id"] ?? null })); return; } response.writeHead(404, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify({ error: { code: "not_found", message: "Not found", requestId: request.headers["x-request-id"] ?? null, retryable: false } })); }),
    close: () => database.close()
  };
}
