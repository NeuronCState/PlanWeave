# Collaboration public contracts v1

**Status:** Frozen for A1–A4. Any incompatible change requires a shared contract review by the Server, CLI, Desktop, MCP, and Runtime owners.  
**Scope:** Wire contracts only; this file creates no endpoint implementation.

## Common HTTP conventions

- Collaboration resources are rooted at `/api/v1`; plural collection names use lowercase kebab case.
- JSON requests and responses use `application/json; charset=utf-8`, except blob transfer endpoints.
- Every response includes `X-Request-Id`. A client may supply a valid UUID in that header; otherwise the server creates one.
- Timestamps are RFC 3339 UTC strings with millisecond precision. IDs and versions are JSON strings when they can exceed JavaScript's safe integer range.

### Error envelope

All non-2xx JSON responses use exactly this envelope:

```ts
type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string; // safe, user-displayable summary; never a stack trace
    requestId: string;
    retryable: boolean;
    details?: Record<string, unknown>; // documented per error code only
  };
};

type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "request_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "idempotency_key_reused"
  | "version_conflict"
  | "state_conflict"
  | "cursor_invalid"
  | "event_cursor_expired"
  | "service_unavailable"
  | "internal_error";
```

Status mapping is fixed: 401 `unauthenticated`, 403 `forbidden`, 404 `not_found`, 409 the three `*_conflict`/`idempotency_key_reused` cases, 410 `event_cursor_expired`, 413 `request_too_large`, 415 `unsupported_media_type`, 422 `validation_failed`, 429 `rate_limited`, 503 `service_unavailable`, and 500 `internal_error`. `version_conflict.details` contains `aggregateType`, `aggregateId`, and `currentVersion` but never an implicit full snapshot.

### Cursor pagination

Collection reads return an opaque cursor; clients must store and replay it verbatim and must not parse, construct, or compare it.

```ts
type Page<T> = { items: T[]; nextCursor: string | null };
```

The query parameters are `cursor` and `limit` (default 50, maximum 100). Cursors encode a stable server ordering and filter fingerprint. A cursor used with different filters or an expired/invalid cursor returns `cursor_invalid` (400). Page ordering is stable only for the lifetime of a cursor.

## Mutating-command consistency

- Every mutating request requires `Idempotency-Key`: an opaque client-generated 16–128 character ASCII token. The server scopes it to authenticated device + route + project, stores a request fingerprint and complete response, and retains it for at least 24 hours.
- Repeating the same key and fingerprint returns the original status/body with `Idempotency-Replayed: true`; it must not append an additional domain event or audit entry. Reusing a key with a different fingerprint returns 409 `idempotency_key_reused`.
- A command that changes an existing aggregate includes `expectedVersion` as a positive integer in its JSON body. Creation commands omit it. The server checks it inside the write transaction and increments the aggregate version exactly once on success.
- A stale `expectedVersion` returns 409 `version_conflict`; clients recover by reading the aggregate/snapshot and intentionally retrying with a new idempotency key where their intent still applies.
- Acceptance, idempotency record, audit entry, and durable domain event commit in one transaction. No successful response is sent before that transaction commits.

## Durable event and WebSocket contracts

Event IDs are monotonically increasing, positive decimal strings allocated by the authoritative store. Aggregate versions are positive JSON numbers and increase only within their aggregate.

```ts
type EventEnvelopeV1 = {
  protocolVersion: 1;
  eventId: string;
  projectId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  type: string;
  occurredAt: string;
};

type WebSocketEventV1 = {
  kind: "event";
  event: EventEnvelopeV1;
};
```

`/events` sends only `WebSocketEventV1` invalidations; it does not carry authoritative aggregate data. Clients persist the greatest contiguous `eventId`, tolerate duplicated events, and resync on a gap, reconnect, unknown event type, or authorization change.

`GET /api/v1/projects/{projectId}/events?afterEventId={decimal-id}&limit={1..100}` returns `Page<EventEnvelopeV1>`. It is the durable replay source. A pruned `afterEventId` returns 410 `event_cursor_expired`, after which the client requests the project snapshot endpoint and resumes from that snapshot's `lastEventId`.

Project snapshot responses include `{ project, lastEventId }`; the projection content is defined by its owning domain package, but `lastEventId` is mandatory. Snapshot and replay race handling is: read snapshot, then replay events strictly after its `lastEventId` until caught up.

## Compatibility boundaries

- `/mcp` remains the existing MCP contract and is not part of `/api/v1`.
- Collaboration state is not added to Plan Package schemas or runtime public exports in A0/A1.
- API v1 additions are additive; removals or semantic changes require `/api/v2` or a separately approved compatibility plan.
