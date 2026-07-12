import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startPlanweaveServer } from "../lifecycle.js";
import { executeIdempotent } from "../store.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("authoritative server store", () => {
  it("migrates a WAL database and atomically replays an idempotent command", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "planweave-server-"));
    directories.push(dataDirectory);
    let reconciled = false;
    const server = await startPlanweaveServer({ dataDirectory, databasePath: join(dataDirectory, "server.sqlite"), host: "127.0.0.1", port: 0, busyTimeoutMs: 5000 }, [() => { reconciled = true; }]);
    try {
      const command = () => executeIdempotent(server.database, {
        deviceId: "device-a", route: "/api/v1/projects", projectId: "project-a", key: "idempotency-key-0001", requestFingerprint: "request-1",
        execute: (unit) => { unit.database.prepare("INSERT INTO projects(id,name,created_at) VALUES (?,?,?)").run("project-a", "Project A", "2026-07-12T00:00:00.000Z"); const eventId = unit.appendEvent({ projectId: "project-a", aggregateType: "project", aggregateId: "project-a", aggregateVersion: 1, type: "project.created" }); unit.audit({ projectId: "project-a", actorId: "user-a", action: "project.create", aggregateType: "project", aggregateId: "project-a", details: {} }); return { eventId }; }
      });
      expect(command()).toEqual({ replayed: false, value: { eventId: "1" } });
      expect(command()).toEqual({ replayed: true, value: { eventId: "1" } });
      expect(server.database.prepare("SELECT COUNT(*) AS count FROM projects").get()?.count).toBe(1);
      expect(server.database.prepare("SELECT COUNT(*) AS count FROM domain_events").get()?.count).toBe(1);
      expect(server.database.prepare("SELECT COUNT(*) AS count FROM audit_log").get()?.count).toBe(1);
      expect(server.readiness()).toEqual({ status: "ready", schemaVersion: 1 });
      expect(reconciled).toBe(true);
      await expect(server.createBackup("before-upgrade.sqlite")).resolves.toContain("before-upgrade.sqlite");
    } finally { server.close(); }
  });
});
