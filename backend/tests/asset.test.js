const { describe, it } = require('node:test');
const request = require('supertest');
const app = require('../src/app');
const assert = require('assert');

describe('Asset Metadata Endpoints', () => {
  it('GET /api/assets should list registered assets', async () => {
    const response = await request(app).get('/api/assets');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert(Array.isArray(response.body.data));
  });

  it('POST /api/assets should register a new asset', async () => {
    const newAsset = {
      name: 'Paris Luxury Apartment',
      category: 'Commercial Real Estate',
      valuation: 4500000,
      location: 'Paris, France'
    };
    const response = await request(app).post('/api/assets').send(newAsset);
    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.name, 'Paris Luxury Apartment');
  });

  it('POST /api/assets should reject invalid input', async () => {
    const response = await request(app).post('/api/assets').send({ name: '' });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.success, false);
  });
});
