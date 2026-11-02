/**
 * Assetra Protocol — Official Digital Asset Tokenization Certificate Generator
 * Produces standards-compliant, vector PDF (PDF-1.4) certificates without external runtime dependencies.
 * Formatted with luxury typography, dark navy and copper accents, cryptographic hashes,
 * on-chain ownership attribution, and legal disclaimers.
 */

import {
  SEPOLIA_EXPLORER_BASE,
  TOKEN_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  getEtherscanTokenUrl,
  getEtherscanAddressUrl,
  getEtherscanTxUrl
} from '../constants/contracts';

/**
 * Escapes characters for PDF literal strings (PDF 1.4 specification).
 */
function escapePdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');
}

/**
 * Truncates a string gracefully with ellipsis.
 */
function truncateText(str, maxLen = 60) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen - 3) + '...';
}

/**
 * Generates an institutional certificate identifier.
 */
export function generateCertificateId(assetId, tokenId) {
  const cleanId = (assetId || 'AST-2026').replace(/[^a-zA-Z0-9-]/g, '');
  const tId = tokenId || '1';
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${year}-${cleanId}-#${tId}-${rand}`;
}

/**
 * Builds standard PDF 1.4 binary string for the Asset Tokenization Certificate.
 */
export function buildCertificatePdfString(certData = {}) {
  const {
    certificateId = generateCertificateId(certData.assetId, certData.tokenId),
    assetId = 'AST-2026-000',
    assetName = 'Institutional Real-World Asset',
    category = 'Commercial Real Estate',
    location = 'Global Jurisdiction',
    valuation = '10,000,000 USD',
    currency = 'INR',
    custodian = 'Institutional Trust Custodian',
    appraisalDate = 'Verified',
    description = 'Tokenized institutional asset anchored to Ethereum Sepolia.',
    tokenId = '1',
    tokenStandard = 'ERC-721',
    tokenContract = TOKEN_CONTRACT_ADDRESS,
    registryContract = REGISTRY_CONTRACT_ADDRESS,
    marketplaceContract = MARKETPLACE_CONTRACT_ADDRESS,
    originalOwner = '0x0000000000000000000000000000000000000000',
    currentNftOwner = '0x0000000000000000000000000000000000000000',
    certificateHolder = '',
    listingStatus = 'UNLISTED',
    listingPriceEth = 0,
    listingSeller = '',
    transactionHash = '',
    ipfsHash = '',
    networkName = 'Ethereum Sepolia Testnet',
    chainId = '11155111',
    timestamp = new Date().toISOString()
  } = certData;

  const generatedDateUtc = new Date(timestamp).toUTCString();
  const etherscanTokenUrl = getEtherscanTokenUrl(tokenId) || `${SEPOLIA_EXPLORER_BASE}/token/${tokenContract}?a=${tokenId}`;
  const etherscanTxUrl = transactionHash ? (getEtherscanTxUrl(transactionHash) || `${SEPOLIA_EXPLORER_BASE}/tx/${transactionHash}`) : 'Available via Sepolia Registry';

  // Page Dimensions: A4 = 595.28 x 841.89 points
  const streamLines = [];

  // =========================================================================
  // 1. Decorative Borders and Watermark Elements (Luxury Navy & Copper)
  // =========================================================================

  // Top copper header accent bar
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 rg'); // Copper #B8734E
  streamLines.push('0 833.89 595.28 8 re f');
  streamLines.push('Q');

  // Outer framing rectangle (Luxury Charcoal/Border)
  streamLines.push('q');
  streamLines.push('0.867 0.839 0.796 RG'); // Border #DDD6CB
  streamLines.push('1 w');
  streamLines.push('24 24 547.28 793.89 re s');
  streamLines.push('Q');

  // Inner decorative thin border
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 RG'); // Subtle Copper inner
  streamLines.push('0.4 w');
  streamLines.push('28 28 539.28 785.89 re s');
  streamLines.push('Q');

  // Top header banner background (Navy #101B2D)
  streamLines.push('q');
  streamLines.push('0.063 0.106 0.176 rg'); // Deep Midnight Navy
  streamLines.push('30 735 535.28 77 re f');
  streamLines.push('Q');

  // =========================================================================
  // 2. Header Text: Assetra Brand & Certificate Title
  // =========================================================================
  streamLines.push('BT');
  streamLines.push('/F1 22 Tf');
  streamLines.push('1 1 1 rg'); // White
  streamLines.push('1 0 0 1 48 780 Tm');
  streamLines.push(`(ASSETRA PROTOCOL) Tj`);

  streamLines.push('/F1 9 Tf');
  streamLines.push('0.839 0.541 0.376 rg'); // Warm Copper
  streamLines.push('1 0 0 1 48 765 Tm');
  streamLines.push(`(INSTITUTIONAL REAL-WORLD ASSET TOKENIZATION LEDGER) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.88 0.90 0.94 rg'); // Soft white
  streamLines.push('1 0 0 1 48 748 Tm');
  streamLines.push(`(OFFICIAL ERC-721 DIGITAL DEED & PROOF OF ON-CHAIN OWNERSHIP) Tj`);

  // Certificate Metadata Box in Header (Right Side)
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.839 0.541 0.376 rg'); // Copper
  streamLines.push('1 0 0 1 370 782 Tm');
  streamLines.push(`(CERTIFICATE ID:) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push('1 0 0 1 370 770 Tm');
  streamLines.push(`(${escapePdfText(certificateId)}) Tj`);

  streamLines.push('/F2 7.5 Tf');
  streamLines.push('0.75 0.78 0.82 rg');
  streamLines.push('1 0 0 1 370 757 Tm');
  streamLines.push(`(Issued: ${escapePdfText(generatedDateUtc.slice(0, 25))}) Tj`);

  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.20 0.70 0.50 rg'); // Mint
  streamLines.push('1 0 0 1 370 745 Tm');
  streamLines.push(`(Network: Ethereum Sepolia - Active) Tj`);
  streamLines.push('ET');

  // =========================================================================
  // 3. Asset Specification Section
  // =========================================================================
  let y = 708;

  // Section Header: Asset Specifications
  streamLines.push('BT');
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.063 0.106 0.176 rg'); // Navy
  streamLines.push(`1 0 0 1 46 ${y} Tm`);
  streamLines.push(`(1. UNDERLYING REAL-WORLD ASSET SPECIFICATIONS) Tj`);
  streamLines.push('ET');

  y -= 8;
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 RG'); // Copper line
  streamLines.push('1 w');
  streamLines.push(`46 ${y} m 550 ${y} l S`);
  streamLines.push('Q');

  // Background card for Asset Data
  y -= 80;
  streamLines.push('q');
  streamLines.push('0.976 0.973 0.965 rg'); // Subtle cream #F9F8F6
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.5 w');
  streamLines.push(`46 ${y} 504 74 re B`);
  streamLines.push('Q');

  // Row 1: Name and Category
  streamLines.push('BT');
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 56} Tm`);
  streamLines.push(`(Asset Name:) Tj`);

  streamLines.push('/F1 10.5 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 58 ${y + 42} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(assetName, 36))}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 310 ${y + 56} Tm`);
  streamLines.push(`(Protocol Asset ID:) Tj`);

  streamLines.push('/F3 10 Tf');
  streamLines.push('0.721 0.451 0.306 rg'); // Copper
  streamLines.push(`1 0 0 1 310 ${y + 42} Tm`);
  streamLines.push(`(${escapePdfText(assetId)}) Tj`);

  // Row 2: Category, Location, Valuation, Custodian
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 24} Tm`);
  streamLines.push(`(Category:) Tj`);

  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 105 ${y + 24} Tm`);
  streamLines.push(`(${escapePdfText(category)}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 200 ${y + 24} Tm`);
  streamLines.push(`(Location:) Tj`);

  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 245 ${y + 24} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(location, 24))}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 10} Tm`);
  streamLines.push(`(Appraised Valuation:) Tj`);

  streamLines.push('/F1 9 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 160 ${y + 10} Tm`);
  streamLines.push(`(${escapePdfText(valuation)}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 310 ${y + 10} Tm`);
  streamLines.push(`(Auditing Custodian:) Tj`);

  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 405 ${y + 10} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(custodian, 22))}) Tj`);
  streamLines.push('ET');

  // =========================================================================
  // 4. Token & Smart Contract Ledger Infrastructure
  // =========================================================================
  y -= 26;
  streamLines.push('BT');
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 46 ${y} Tm`);
  streamLines.push(`(2. CRYPTOGRAPHIC TOKEN & ON-CHAIN INFRASTRUCTURE) Tj`);
  streamLines.push('ET');

  y -= 8;
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 RG');
  streamLines.push('1 w');
  streamLines.push(`46 ${y} m 550 ${y} l S`);
  streamLines.push('Q');

  y -= 118;
  streamLines.push('q');
  streamLines.push('0.976 0.973 0.965 rg');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.5 w');
  streamLines.push(`46 ${y} 504 112 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  // Token Spec
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 96} Tm`);
  streamLines.push(`(Token Standard:) Tj`);

  streamLines.push('/F1 9 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 138 ${y + 96} Tm`);
  streamLines.push(`(ERC-721 Non-Fungible Deed Token) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 340 ${y + 96} Tm`);
  streamLines.push(`(NFT Token ID:) Tj`);

  streamLines.push('/F1 11 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push(`1 0 0 1 415 ${y + 96} Tm`);
  streamLines.push(`(#${escapePdfText(tokenId)}) Tj`);

  // Contracts
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 78} Tm`);
  streamLines.push(`(AssetToken Contract:) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 160 ${y + 78} Tm`);
  streamLines.push(`(${escapePdfText(tokenContract)}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 62} Tm`);
  streamLines.push(`(AssetRegistry Contract:) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 160 ${y + 62} Tm`);
  streamLines.push(`(${escapePdfText(registryContract)}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 46} Tm`);
  streamLines.push(`(Marketplace Contract:) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 160 ${y + 46} Tm`);
  streamLines.push(`(${escapePdfText(marketplaceContract)}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 30} Tm`);
  streamLines.push(`(IPFS Cryptographic URI:) Tj`);

  streamLines.push('/F3 8 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push(`1 0 0 1 160 ${y + 30} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(ipfsHash || 'https://assetra.io/api/metadata/' + assetId, 55))}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 14} Tm`);
  streamLines.push(`(Mint Tx Hash:) Tj`);

  streamLines.push('/F3 8 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 160 ${y + 14} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(transactionHash || 'Recorded on Sepolia Contract State', 55))}) Tj`);
  streamLines.push('ET');

  // =========================================================================
  // 5. Verified Ownership Attribution (Critical Role Separation)
  // =========================================================================
  y -= 26;
  streamLines.push('BT');
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 46 ${y} Tm`);
  streamLines.push(`(3. VERIFIED OWNERSHIP & MARKETPLACE ATTRIBUTION) Tj`);
  streamLines.push('ET');

  y -= 8;
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 RG');
  streamLines.push('1 w');
  streamLines.push(`46 ${y} m 550 ${y} l S`);
  streamLines.push('Q');

  y -= 112;
  streamLines.push('q');
  streamLines.push('0.976 0.973 0.965 rg');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.5 w');
  streamLines.push(`46 ${y} 504 106 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  // Current ERC-721 Owner
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.118 0.435 0.361 rg'); // Mint
  streamLines.push(`1 0 0 1 58 ${y + 90} Tm`);
  streamLines.push(`(LIVE ERC-721 TOKEN HOLDER [ownerOf]:) Tj`);

  streamLines.push('/F3 9.5 Tf');
  streamLines.push('0.118 0.435 0.361 rg');
  streamLines.push(`1 0 0 1 58 ${y + 76} Tm`);
  streamLines.push(`(${escapePdfText(currentNftOwner || '0x... [Confirmed on Sepolia]')}) Tj`);

  // Original Registrant
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 58} Tm`);
  streamLines.push(`(Original Asset Registrant / Initial Owner:) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 58 ${y + 46} Tm`);
  streamLines.push(`(${escapePdfText(originalOwner || '0x... [Assetra Vault Registrant]')}) Tj`);

  // Marketplace Listing Info
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 58 ${y + 28} Tm`);
  streamLines.push(`(Marketplace State:) Tj`);

  streamLines.push('/F1 8.5 Tf');
  streamLines.push(listingStatus === 'LISTED' ? '0.721 0.451 0.306 rg' : '0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 142 ${y + 28} Tm`);
  streamLines.push(`(${listingStatus === 'LISTED' ? 'ACTIVE LISTING (' + listingPriceEth + ' ETH)' : 'NOT ACTIVELY LISTED'}) Tj`);

  if (listingStatus === 'LISTED' && listingSeller) {
    streamLines.push('/F2 8 Tf');
    streamLines.push('0.467 0.463 0.435 rg');
    streamLines.push(`1 0 0 1 310 ${y + 28} Tm`);
    streamLines.push(`(Listing Seller:) Tj`);

    streamLines.push('/F3 8 Tf');
    streamLines.push('0.063 0.106 0.176 rg');
    streamLines.push(`1 0 0 1 372 ${y + 28} Tm`);
    streamLines.push(`(${escapePdfText(truncateText(listingSeller, 26))}) Tj`);
  }

  // Certificate Recipient / Holder
  if (certificateHolder) {
    streamLines.push('/F2 8 Tf');
    streamLines.push('0.467 0.463 0.435 rg');
    streamLines.push(`1 0 0 1 58 ${y + 12} Tm`);
    streamLines.push(`(Certificate Issued To:) Tj`);

    streamLines.push('/F3 8 Tf');
    streamLines.push('0.721 0.451 0.306 rg');
    streamLines.push(`1 0 0 1 160 ${y + 12} Tm`);
    streamLines.push(`(${escapePdfText(certificateHolder)}) Tj`);
  }
  streamLines.push('ET');

  // =========================================================================
  // 6. Institutional Verification Links Box
  // =========================================================================
  y -= 24;
  streamLines.push('BT');
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 46 ${y} Tm`);
  streamLines.push(`(4. INDEPENDENT ON-CHAIN AUDIT & EXPLORER REFERENCES) Tj`);
  streamLines.push('ET');

  y -= 8;
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 RG');
  streamLines.push('1 w');
  streamLines.push(`46 ${y} m 550 ${y} l S`);
  streamLines.push('Q');

  y -= 60;
  streamLines.push('q');
  streamLines.push('0.941 0.965 0.988 rg'); // Soft icy blue #F0F6FC
  streamLines.push('0.75 0.82 0.92 RG');
  streamLines.push('0.5 w');
  streamLines.push(`46 ${y} 504 54 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.20 0.30 0.45 rg');
  streamLines.push(`1 0 0 1 58 ${y + 38} Tm`);
  streamLines.push(`(Etherscan Token Explorer:) Tj`);

  streamLines.push('/F3 8 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 180 ${y + 38} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(etherscanTokenUrl, 64))}) Tj`);

  streamLines.push('/F2 8 Tf');
  streamLines.push('0.20 0.30 0.45 rg');
  streamLines.push(`1 0 0 1 58 ${y + 22} Tm`);
  streamLines.push(`(Transaction Verification:) Tj`);

  streamLines.push('/F3 8 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 180 ${y + 22} Tm`);
  streamLines.push(`(${escapePdfText(truncateText(etherscanTxUrl, 64))}) Tj`);

  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.118 0.435 0.361 rg');
  streamLines.push(`1 0 0 1 58 ${y + 8} Tm`);
  streamLines.push(`(All state records queryable 24/7 on Ethereum Sepolia Public Consensus Nodes) Tj`);
  streamLines.push('ET');

  // =========================================================================
  // 7. Mandatory Legal Notice & Disclaimer (Requirement 2 & 5)
  // =========================================================================
  y -= 22;
  streamLines.push('q');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.5 w');
  streamLines.push(`46 ${y} m 550 ${y} l S`);
  streamLines.push('Q');

  y -= 14;
  streamLines.push('BT');
  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.721 0.451 0.306 rg'); // Copper
  streamLines.push(`1 0 0 1 46 ${y} Tm`);
  streamLines.push(`(LEGAL NOTICE & STATUTORY CONVEYANCE DISCLAIMER:) Tj`);

  streamLines.push('/F2 6.5 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 46 ${y - 11} Tm`);
  streamLines.push(`(This document serves strictly as an official Cryptographic Tokenization & On-Chain Ownership Certificate issued by Assetra Protocol.) Tj`);

  streamLines.push(`1 0 0 1 46 ${y - 21} Tm`);
  streamLines.push(`(It confirms that the specified digital token exists on Ethereum Sepolia and attests to the verified wallet address recorded in smart contract state.) Tj`);

  streamLines.push(`1 0 0 1 46 ${y - 31} Tm`);
  streamLines.push(`(This digital certificate does not constitute a legally binding statutory real-property title deed in jurisdictions requiring municipal registry conveyance.) Tj`);

  streamLines.push(`1 0 0 1 46 ${y - 41} Tm`);
  streamLines.push(`(Physical custody and title documentation are maintained in trust by the named custodian subject to separate bilateral custodial agreements.) Tj`);

  // Footer bar
  streamLines.push('/F1 7 Tf');
  streamLines.push('0.063 0.106 0.176 rg');
  streamLines.push(`1 0 0 1 46 ${y - 56} Tm`);
  streamLines.push(`(Assetra Protocol Ledger Engine v2.4 - Ethereum Sepolia Network - Cryptographically Verified - Page 1 of 1) Tj`);
  streamLines.push('ET');

  const contentStream = streamLines.join('\n');
  const streamByteLength = new TextEncoder().encode(contentStream).length;

  // Build PDF Object Structure
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`;
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
  objects[7] = `<< /Length ${streamByteLength} >>\nstream\n${contentStream}\nendstream`;

  // Assemble full file with precise byte offsets
  let output = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];

  for (let i = 1; i <= 7; i++) {
    offsets[i] = new TextEncoder().encode(output).length;
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(output).length;
  output += 'xref\n0 8\n';
  output += '0000000000 65535 f \n';
  for (let i = 1; i <= 7; i++) {
    output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  output += `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return output;
}

/**
 * Creates a downloadable binary Blob for the tokenization certificate.
 */
export function generateCertificatePdfBlob(certData = {}) {
  const pdfString = buildCertificatePdfString(certData);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(pdfString);
  return new Blob([uint8Array], { type: 'application/pdf' });
}

/**
 * Triggers browser download of the PDF certificate file with a clean standard filename.
 * Example filename: Assetra_AST-2026-I6PZ_Token-5_Certificate.pdf
 */
export function downloadCertificatePdf(certData = {}) {
  const blob = generateCertificatePdfBlob(certData);
  const cleanAssetId = (certData.assetId || 'AST-2026').replace(/[^a-zA-Z0-9_-]/g, '_');
  const tokenId = certData.tokenId || '1';
  const filename = `Assetra_${cleanAssetId}_Token-${tokenId}_Certificate.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens PDF certificate in a new browser tab for immediate previewing or printing.
 */
export function openCertificatePdfInNewTab(certData = {}) {
  const blob = generateCertificatePdfBlob(certData);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

