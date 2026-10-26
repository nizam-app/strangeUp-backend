# API Envelope — Foundation (Task 001)

**Status:** implemented for health and error middleware only. Product `/v1/*` routes are not built yet.

This follows the proposed contract in `docs/api/CONVENTIONS.md`.

## Success

```json
{
  "data": { },
  "meta": {
    "requestId": "uuid-or-client-supplied"
  }
}
```

## Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable, non-sensitive message",
    "requestId": "uuid-or-client-supplied"
  }
}
```

## Stable error codes (foundation)

| Code | Typical HTTP | When |
|------|----------------|------|
| `VALIDATION_ERROR` | 400 | Invalid JSON or request validation failure |
| `NOT_FOUND` | 404 | Unknown route |
| `INTERNAL_ERROR` | 500 | Unexpected server error (sanitized in production) |
| `SERVICE_UNAVAILABLE` | 503 | Readiness dependency failure (e.g. database down) |

Request correlation uses the `x-request-id` header (generated if omitted).

OpenAPI stub for health endpoints: `openapi/foundation.yaml`.
