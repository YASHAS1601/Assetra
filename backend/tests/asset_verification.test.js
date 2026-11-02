const { describe, it, before } = require('node:test');
const request = require('supertest');
const app = require('../src/app');
const assert = require('assert');

describe('Asset Verification & Admin Authorization Suite', () => {
  let userToken;
  let adminToken;

  before(async () => {
    // Register normal user
    const userRes = await request(app).post('/api/auth/register').send({
      email: 'applicant@assetra.io',
      password: 'ApplicantPass123!',
      fullName: 'Applicant User'
    });
    userToken = userRes.body.data.token;

    // Login default seeded admin
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@assetra.io',
      password: 'AdminPassword123!'
    });
    adminToken = adminRes.body.data.token;
  });

  it('Normal USER should be REJECTED with 403 when attempting to access /api/admin/submissions', async () => {
    const res = await request(app)
      .get('/api/admin/submissions')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Forbidden');
  });

  it('Authenticated ADMIN should successfully access /api/admin/submissions', async () => {
    const res = await request(app)
      .get('/api/admin/submissions')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.metrics);
  });

  it('Admin approval flow should set status to APPROVED', async () => {
    const approveRes = await request(app)
      .post('/api/admin/submissions/AST-2026-002/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verified title deed documents.' });

    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.data.status, 'APPROVED');
    assert.strictEqual(approveRes.body.data.isVerified, true);
  });

  it('Admin rejection flow should REQUIRE a reason', async () => {
    const rejectNoReason = await request(app)
      .post('/api/admin/submissions/AST-2026-002/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' });

    assert.strictEqual(rejectNoReason.status, 400);

    const rejectWithReason = await request(app)
      .post('/api/admin/submissions/AST-2026-002/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Unverifiable ownership deed hash.' });

    assert.strictEqual(rejectWithReason.status, 200);
    assert.strictEqual(rejectWithReason.body.data.status, 'REJECTED');
  });

  it('Admin request additional info flow should set status to MORE_INFO_REQUESTED', async () => {
    const infoRes = await request(app)
      .post('/api/admin/submissions/AST-2026-002/request-info')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Please provide updated 2026 tax clearance appraisal.' });

    assert.strictEqual(infoRes.status, 200);
    assert.strictEqual(infoRes.body.data.status, 'MORE_INFO_REQUESTED');
  });
});
