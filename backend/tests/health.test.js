const { describe, it } = require('node:test');
const request = require('supertest');
const app = require('../src/app');
const assert = require('assert');

describe('GET /api/health', () => {
  it('should return 200 OK and healthy status', async () => {
    const response = await request(app).get('/api/health');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'healthy');
    assert.strictEqual(response.body.service, 'Assetra REST API & Event Indexer');
  });
});
