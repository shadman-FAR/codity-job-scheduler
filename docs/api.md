# API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require header: `Authorization: Bearer <token>`

Response format:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

## Auth
| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | /auth/register | No | `{email, password, name}` |
| POST | /auth/login | No | `{email, password}` |
| GET | /auth/me | Yes | — |

## Projects
| Method | Endpoint | Body |
|---|---|---|
| POST | /projects | `{name, description?}` |
| GET | /projects | — |
| GET | /projects/:id | — |
| PUT | /projects/:id | `{name, description}` |
| DELETE | /projects/:id | — |

## Queues
| Method | Endpoint | Body |
|---|---|---|
| POST | /projects/:projectId/queues | `{name, priority?, concurrencyLimit?, retryStrategy?, maxAttempts?, baseDelaySeconds?}` |
| GET | /projects/:projectId/queues | — |
| GET | /queues/:id | — |
| PUT | /queues/:id | same as create |
| PATCH | /queues/:id/pause | — |
| PATCH | /queues/:id/resume | — |
| DELETE | /queues/:id | — |
| GET | /queues/:id/stats | — |

## Jobs
| Method | Endpoint | Body |
|---|---|---|
| POST | /queues/:queueId/jobs | `{type, payload, priority?, delaySeconds?, scheduledFor?, cronExpression?}` |
| POST | /queues/:queueId/jobs/batch | `{jobs: [{payload, priority?}]}` |
| GET | /queues/:queueId/jobs?status=&type=&page=&limit= | — |
| GET | /jobs/:id | — |

## Workers
| Method | Endpoint |
|---|---|
| GET | /workers |
| GET | /workers/:id |

## DLQ
| Method | Endpoint |
|---|---|
| GET | /dlq |
| POST | /dlq/:id/retry |

## Metrics
| Method | Endpoint |
|---|---|
| GET | /metrics |

## Example: create IMMEDIATE job
Request:
```json
POST /api/queues/{queueId}/jobs
{ "type": "IMMEDIATE", "payload": { "action": "send_email" } }
```
Response (201):
```json
{ "success": true, "data": { "id": "...", "status": "QUEUED", "type": "IMMEDIATE", ... } }
```