import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/utils/prismaClient.js';

const testEmail = `jest-${Date.now()}@example.com`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Auth', () => {
  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail, password: 'password123', name: 'Jest User',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
  });

  test('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail, password: 'password123', name: 'Jest User',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail, password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  test('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail, password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});