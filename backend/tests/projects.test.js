import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/utils/prismaClient.js';

const testEmail = `jest-proj-${Date.now()}@example.com`;
let token;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: testEmail, password: 'password123', name: 'Jest Proj User',
  });
  token = res.body.data.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Projects', () => {
  let projectId;

  test('creates a project', async () => {
    const res = await request(app).post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jest Project' });
    expect(res.status).toBe(201);
    projectId = res.body.data.id;
  });

  test('lists projects', async () => {
    const res = await request(app).get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('rejects access without token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  test('deletes the project', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});