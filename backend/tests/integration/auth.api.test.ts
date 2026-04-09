import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { UserModel } from '../../src/modules/users/user.model';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

// These tests require a running MongoDB instance
// Set TEST_MONGODB_URI in .env.test or environment

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
let authToken: string;

beforeAll(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/intelligence_test';
  process.env.MONGODB_URI = uri;
  await connectDatabase();
});

afterAll(async () => {
  await UserModel.deleteMany({ email: TEST_EMAIL });
  await disconnectDatabase();
});

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.user.email).toBe(TEST_EMAIL);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      authToken = res.body.data.token;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(409);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'new@example.com', password: 'short' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(TEST_EMAIL);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
