# Design Decisions

**Why PostgreSQL over MongoDB?** The assignment requires relational integrity (Users→Orgs→Projects→Queues→Jobs) and, critically, row-level locking for atomic job claiming via conditional UPDATE. PostgreSQL's transactional guarantees are what make single-claim correctness possible without a separate distributed lock service.

**Why Prisma?** Type-safe queries generated from schema, tracked migrations as version-controlled files, and an escape hatch (`updateMany` with WHERE conditions, `$transaction`) for the low-level control atomic claiming requires.

**Why Node.js/Express?** Consistent language across API, worker, and frontend; mature ecosystem; async/await maps naturally onto I/O-bound job processing.

**Why a separate worker process, not a route?** Genuinely demonstrates distributed-system behavior — multiple independent processes coordinating solely through shared database state, provable by running 2+ worker instances simultaneously.

**Why atomic `updateMany` instead of SELECT FOR UPDATE?** Simpler to express through Prisma's query builder while achieving the same guarantee: PostgreSQL only lets one transaction's UPDATE succeed against a row matching `status = 'QUEUED'` at a time; the loser's `updateMany` affects 0 rows, which we detect and treat as "someone else got it."

**Why polling instead of WebSockets?** Sufficient for an MVP's update cadence (dashboard refresh every few seconds is acceptable), avoids the complexity of persistent connection management, and the assignment explicitly deprioritizes WebSockets versus core reliability features.

**Why concurrency via multiple processes rather than intra-process parallelism?** Node.js is single-threaded for JS execution; rather than fighting that with worker_threads complexity, we lean into the model real systems like Sidekiq use — horizontal scaling via more worker processes.

**Why JWT over sessions?** Stateless API server (no session store needed), fits the "distributed" theme, standard trade-off accepted: can't instantly revoke a token before expiry (7-day expiry chosen as a reasonable MVP balance).

**Trade-offs as an MVP:** No distributed locking beyond single-database row locks (fine for one Postgres instance, would need Redis/etcd-based locking at bigger scale); no queue sharding; no workflow dependencies between jobs.