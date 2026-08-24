# Codity.ai Job Scheduler

A production-inspired Distributed Job Scheduler for asynchronous background job execution across multiple workers, built for the Codity.ai SDE-1 technical assignment.

## Problem Statement
Modern applications need to run work asynchronously — sending emails, processing payments, generating reports — without blocking the user-facing request. This requires a reliable system to queue, schedule, execute, retry, and monitor background jobs across potentially many worker processes, without losing jobs or executing them twice.

## Features
- JWT authentication (register/login/protected routes)
- Projects → Queues → Jobs hierarchy, organization-scoped
- 5 job types: Immediate, Delayed, Scheduled, Recurring (cron), Batch
- Full job lifecycle: Queued → Scheduled → Claimed → Running → Completed/Failed/Retrying/Dead
- **Atomic job claiming** via conditional `updateMany`, proven race-condition-free under concurrent load
- Per-queue concurrency limits, enforced atomically
- Configurable retry strategies: Fixed, Linear, Exponential backoff
- Dead Letter Queue with manual retry
- Worker heartbeats with live ONLINE/STALE/OFFLINE status computation
- Graceful worker shutdown (SIGINT/SIGTERM)
- React dashboard: metrics, projects, queues, jobs, workers, DLQ
- Jest + Supertest test suite including a live concurrency proof

## Architecture
See [docs/architecture.md](docs/architecture.md).

## Tech Stack
- **Frontend:** React, Vite, React Router, Axios
- **Backend:** Node.js, Express, JWT, bcryptjs
- **Database:** PostgreSQL + Prisma ORM
- **Worker:** Standalone Node.js process, polling-based
- **Testing:** Jest, Supertest
- **Docs:** Markdown + Mermaid ER diagram

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

## Installation

```bash
git clone https://github.com/shadman-FAR/codity-job-scheduler.git
cd codity-job-scheduler
```

### Backend
```bash
cd backend
npm install
```

Create `backend/.env`: