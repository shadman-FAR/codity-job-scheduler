# System Architecture

## Overview

Frontend (React) → Express API → PostgreSQL ← Worker process(es)

The API server and worker are **separate Node.js processes** sharing the same PostgreSQL database and Prisma schema. They never communicate directly — all coordination happens through the shared database, which is what makes this genuinely distributed rather than a simulated worker inside an API route.

## Components

**Frontend (React/Vite):** Talks only to the REST API over HTTP. Polls every 5s for live updates (dashboard, queue stats, worker status) rather than using WebSockets, since polling is sufficient for an MVP's update frequency needs and avoids the complexity of maintaining persistent connections.

**API Server (Express):** Handles auth, CRUD for projects/queues/jobs, DLQ management, metrics. Stateless — no server-side sessions, JWT carries all auth state.

**PostgreSQL + Prisma:** Single source of truth. Row-level locking via conditional `UPDATE ... WHERE status = 'QUEUED'` is what makes atomic job claiming possible.

**Worker:** Standalone process (`node src/worker/worker.js`). Polls every 1s for claimable jobs, sends heartbeats every 5s, executes jobs, handles retry/DLQ logic, shuts down gracefully on SIGINT/SIGTERM.

## Job Lifecycle