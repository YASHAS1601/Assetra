const { describe, it } = require('node:test');
const assert = require('assert');
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

describe('Supabase Integration & Architecture Suite', () => {
  it('Supabase client module should export getStatus() with environment validation', () => {
    const status = supabase.getStatus();
    assert.strictEqual(typeof status, 'object');
    assert.strictEqual(status.url, 'https://ofdzzynjlyigoliqfgbl.supabase.co');
    assert.strictEqual(typeof status.configured, 'boolean');
    assert.strictEqual(typeof status.hasSecretKey, 'boolean');
    assert.strictEqual(typeof status.hasPublishableKey, 'boolean');
  });

  it('GET /api/health should expose Supabase backend service configuration status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'healthy');
    assert(res.body.supabase, 'Health response should contain supabase status');
    assert.strictEqual(res.body.supabase.url, 'https://ofdzzynjlyigoliqfgbl.supabase.co');
  });

  it('Public registration endpoint must never allow user to elevate themselves to ADMIN role', async () => {
    const uniqueEmail = `testuser_${Date.now()}@assetra.io`;
    const res = await request(app).post('/api/auth/register').send({
      email: uniqueEmail,
      password: 'UserPassword123!',
      fullName: 'Test Applicant',
      role: 'ADMIN' // Malicious attempt to register as ADMIN
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.user.role, 'USER', 'Server must strictly enforce USER role');
  });

  it('Protected admin endpoints should reject unauthorized unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/admin/submissions');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
  });

  it('Protected admin endpoints should reject USER tokens with 403 Forbidden', async () => {
    const userRes = await request(app).post('/api/auth/register').send({
      email: `regular_${Date.now()}@assetra.io`,
      password: 'RegularPassword123!',
      fullName: 'Regular User'
    });

    const userToken = userRes.body.data.token;
    const res = await request(app)
      .get('/api/admin/submissions')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Forbidden');
  });
});
