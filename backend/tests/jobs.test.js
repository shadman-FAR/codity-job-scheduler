import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/utils/prismaClient.js';

const testEmail = `jest-jobs-${Date.now()}@example.com`;
let token, queueId;

beforeAll(async () => {
  const reg = await request(app).post('/api/auth/register').send({
    email: testEmail, password: 'password123', name: 'Jest Jobs User',
  });
  token = reg.body.data.token;

  const proj = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`).send({ name: 'Jest Jobs Project' });

  const queue = await request(app).post(`/api/projects/${proj.body.data.id}/queues`)
    .set('Authorization', `Bearer ${token}`).send({ name: 'jest-queue', concurrencyLimit: 2 });
  queueId = queue.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Jobs', () => {
  test('creates an IMMEDIATE job', async () => {
    const res = await request(app).post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'IMMEDIATE', payload: { test: true } });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('QUEUED');
  });

  test('rejects DELAYED job without delaySeconds', async () => {
    const res = await request(app).post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'DELAYED', payload: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects invalid cron expression', async () => {
    const res = await request(app).post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'RECURRING', cronExpression: 'garbage', payload: {} });
    expect(res.status).toBe(400);
  });

  test('creates batch jobs', async () => {
    const res = await request(app).post(`/api/queues/${queueId}/jobs/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jobs: [{ payload: { a: 1 } }, { payload: { a: 2 } }] });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(2);
  });

  test('lists jobs with pagination', async () => {
    const res = await request(app).get(`/api/queues/${queueId}/jobs?page=1&limit=10`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
  });
});