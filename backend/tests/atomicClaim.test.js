import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/utils/prismaClient.js';

const testEmail = `jest-claim-${Date.now()}@example.com`;
let token, queueId, jobId;

beforeAll(async () => {
  const reg = await request(app).post('/api/auth/register').send({
    email: testEmail, password: 'password123', name: 'Jest Claim User',
  });
  token = reg.body.data.token;

  const proj = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`).send({ name: 'Jest Claim Project' });

  const queue = await request(app).post(`/api/projects/${proj.body.data.id}/queues`)
    .set('Authorization', `Bearer ${token}`).send({ name: 'claim-test-queue', concurrencyLimit: 5 });
  queueId = queue.body.data.id;

  const job = await request(app).post(`/api/queues/${queueId}/jobs`)
    .set('Authorization', `Bearer ${token}`).send({ type: 'IMMEDIATE', payload: {} });
  jobId = job.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

/**
 * This test proves the atomic claim mechanism (Prisma updateMany with a
 * conditional WHERE status='QUEUED') prevents double-claiming even when
 * multiple "workers" attempt to claim the exact same job simultaneously.
 *
 * We simulate 5 concurrent claim attempts using Promise.all -- only one
 * should succeed (count: 1), the other four must get count: 0.
 */
test('only one concurrent claim attempt succeeds on the same job', async () => {
  const claimAttempts = Array.from({ length: 5 }, () =>
    prisma.job.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', claimedBy: `test-worker-${Math.random()}` },
    })
  );

  const results = await Promise.all(claimAttempts);
  const successCount = results.filter((r) => r.count === 1).length;
  const failCount = results.filter((r) => r.count === 0).length;

  expect(successCount).toBe(1);
  expect(failCount).toBe(4);

  const finalJob = await prisma.job.findUnique({ where: { id: jobId } });
  expect(finalJob.status).toBe('RUNNING');
});