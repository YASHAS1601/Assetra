# Assetra REST API Specifications

Base URL: `http://localhost:5000/api`

---

## 1. System Health

### `GET /api/health`
Returns system status, active environment, database connection health, and configured contract addresses.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "service": "Assetra REST API & Event Indexer",
  "environment": "development",
  "timestamp": "2026-10-10T20:00:00.000Z",
  "database": {
    "type": "PostgreSQL",
    "connected": true,
    "host": "localhost",
    "database": "assetra_db"
  },
  "blockchain": {
    "rpcUrl": "http://127.0.0.1:8545",
    "registryAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "tokenAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  }
}
```

---

## 2. Asset Metadata Endpoints

### `GET /api/assets`
List registered real-world assets. Supports optional filtering by `category` and `status`.

**Query Parameters**:
- `category` (optional): Filter by category name (e.g., `Commercial Real Estate`).
- `status` (optional): Filter by status (e.g., `Tokenized`, `Registered`).

### `GET /api/assets/:id`
Fetch single asset details by unique Asset ID.

### `POST /api/assets`
Create a new off-chain asset registry record.

**Request Body**:
```json
{
  "name": "One Vanderbilt Suite 4200",
  "category": "Commercial Real Estate",
  "location": "Manhattan, New York, USA",
  "valuation": 18500000,
  "currency": "USD",
  "appraisalDate": "2026-04-15",
  "custodian": "CBRE Global Asset Management",
  "ownerAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "autoTokenize": true
}
```

---

## 3. Blockchain Event Indexing

### `GET /api/transactions`
List audited blockchain ledger events.

### `POST /api/transactions/index`
Index a newly broadcasted smart contract transaction event.
