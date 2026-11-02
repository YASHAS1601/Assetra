const { describe, it } = require('node:test');
const request = require('supertest');
const app = require('../src/app');
const assert = require('assert');

describe('RBAC Authentication Suite', () => {
  it('POST /api/auth/register should ALWAYS assign USER role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user_test@assetra.io',
        password: 'UserPass123!',
        fullName: 'Test User',
        role: 'ADMIN' // Client attempt to self-assign ADMIN
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.role, 'USER', 'Registration MUST ignore client role and force USER');
  });

  it('POST /api/auth/login should authenticate valid user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user_test@assetra.io',
        password: 'UserPass123!'
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.data.token);
    assert.strictEqual(res.body.data.user.email, 'user_test@assetra.io');
  });

  it('POST /api/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user_test@assetra.io',
        password: 'WrongPassword'
      });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });
});
