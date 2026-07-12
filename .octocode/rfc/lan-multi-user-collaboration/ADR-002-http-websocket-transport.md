# ADR-002: Isolate collaboration HTTP/WebSocket transport from MCP

**Status:** Accepted for A1/A4 implementation  
**Date:** 2026-07-12  
**Approver:** Pending — a named schema/security approver is required before any public server API or schema migration is merged.

## Decision

Build a dedicated `@planweave-ai/server` listener using Node `node:http` plus `ws` 8.x for RFC 6455 upgrades. Keep application services transport-neutral. The listener owns `/api/v1/*`, `/events`, `/blobs/*`, `/healthz`, and `/readyz`.

The existing `@planweave-ai/mcp` listener continues to own `/mcp` unchanged. A deployment may put both listeners behind one TLS reverse proxy, or a later explicit MCP application gateway may delegate remote tools to server application services. `packages/mcp/src/server.ts` must not become the collaboration application server.

## Spike evidence and comparison

The existing MCP server is a deliberately narrow `node:http` router: it creates a per-POST Streamable HTTP transport and exposes health plus `/mcp`. Its routing and authentication rules are therefore preserved rather than expanded. In a system-temporary ESM spike, `ws` `8.21.0` successfully attached a `WebSocketServer` to a Node HTTP server and completed a loopback upgrade/message handshake. The package declares Node >=10 and is pure JavaScript, so it has no platform-specific build step.

| Option | HTTP/API fit | WebSocket fit | `/mcp` compatibility | Decision |
|---|---|---|---|---|
| Dedicated Node HTTP listener + `ws` | Small, explicit dependency surface; works with the repository's ESM/Node baseline | Mature server upgrade, ping/pong, close, and backpressure primitives | Separate listener/proxy keeps current clients working verbatim | **Selected** |
| Extend `packages/mcp/src/server.ts` | Couples collaboration lifecycle, auth, and route policy to an MCP-specific POST transport | Requires adding upgrade handling to an unrelated server | High regression risk for current `/mcp` behavior | Rejected |
| Add a full HTTP framework/router now | Could reduce endpoint boilerplate later | Requires adapter-specific WebSocket semantics | Does not solve MCP ownership; expands the A0 dependency decision | Deferred; may be reconsidered behind the frozen contracts |

`ws` is selected as an A1 server dependency, not installed during A0 because A0 is prohibited from adding a production server package. A1 must add it to `packages/server/package.json`, regenerate the lockfile, then prove `pnpm install --frozen-lockfile`, server typecheck/build, and a real HTTP plus WebSocket handshake on supported CI targets.

## Transport rules

- TLS is terminated by the deployment boundary; direct LAN HTTP is permitted only for explicitly configured trusted-network development/pilot deployments.
- Authenticate the WebSocket upgrade before accepting it. CLI and Electron main-process clients use `Authorization`; browser clients must use a short-lived, single-use WebSocket ticket issued by an authenticated API call, never an access token in a query string.
- `/events` is an invalidation channel. Durable replay and snapshots remain HTTP reads, so a lost notification cannot lose state.
- Bounded outbound queues, heartbeat/ping-pong, slow-consumer close, and reauthorization on membership/session change are mandatory A4 behavior.

## Rollback

Disable the collaboration listener or freeze mutating routes while retaining the database and audit log. Existing MCP and local workflows continue on their current listener and do not depend on this transport.
