/**
 * Assetra Protocol — Institutional PDF Receipt Generator
 * Produces standards-compliant, vector PDF (PDF-1.4) receipts without external runtime dependencies.
 * Formatted with institutional typography, cryptographic hashes, and verification links.
 */

import { SEPOLIA_EXPLORER_BASE, TOKEN_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from '../constants/contracts';

/**
 * Escapes characters for PDF literal strings.
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
 * Generates an institutional receipt number from transaction hash or timestamp.
 */
export function generateReceiptNumber(txHash) {
  const year = new Date().getFullYear();
  if (txHash && txHash.length >= 10) {
    const hashSegment = txHash.replace(/^0x/, '').slice(0, 6).toUpperCase();
    return `REC-${year}-${hashSegment}`;
  }
  const randomSeg = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REC-${year}-${randomSeg}`;
}

/**
 * Builds standard PDF 1.4 binary string for a confirmed purchase settlement.
 */
export function buildReceiptPdfString(receiptData = {}) {
  const {
    receiptNumber = generateReceiptNumber(receiptData.transactionHash),
    assetId = 'AST-2026-000',
    assetName = 'Tokenized Institutional Asset',
    category = 'Real-World Asset',
    location = 'Global Custody',
    valuation = '1,000,000 USD',
    custodian = 'Institutional Custody Trust',
    tokenId = '1',
    tokenContract = TOKEN_CONTRACT_ADDRESS,
    marketplaceContract = MARKETPLACE_CONTRACT_ADDRESS,
    buyerWallet = '0x0000000000000000000000000000000000000000',
    sellerWallet = '0x0000000000000000000000000000000000000000',
    priceEth = '1.0000',
    currency = 'ETH',
    transactionHash = '0x0000000000000000000000000000000000000000000000000000000000000000',
    blockNumber = 0,
    chainId = '11155111',
    networkName = 'Ethereum Sepolia Testnet',
    gasFee = '0.0050 ETH',
    timestamp = new Date().toISOString()
  } = receiptData;

  const etherscanUrl = `${SEPOLIA_EXPLORER_BASE}/tx/${transactionHash}`;
  const formattedDate = new Date(timestamp).toUTCString();

  // Page Dimensions: A4 = 595.28 x 841.89 points
  // Construct drawing & text stream
  const streamLines = [];

  // 1. Top copper header accent bar (height: 6pt)
  streamLines.push('q');
  streamLines.push('0.721 0.451 0.306 rg'); // Copper #B8734E
  streamLines.push('0 835.89 595.28 6 re f');
  streamLines.push('Q');

  // 2. Header Area: Brand Logo & Title
  streamLines.push('BT');
  streamLines.push('/F1 20 Tf');
  streamLines.push('0.125 0.129 0.121 rg'); // Charcoal #20211F
  streamLines.push('1 0 0 1 40 795 Tm');
  streamLines.push(`(ASSETRA PROTOCOL) Tj`);

  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.721 0.451 0.306 rg'); // Copper
  streamLines.push('1 0 0 1 40 782 Tm');
  streamLines.push(`(INSTITUTIONAL REAL-WORLD ASSET SETTLEMENT SYSTEM) Tj`);

  streamLines.push('/F2 8.5 Tf');
  streamLines.push('0.467 0.463 0.435 rg'); // Muted grey
  streamLines.push('1 0 0 1 40 770 Tm');
  streamLines.push(`(PROOF OF ACQUISITION & SMART CONTRACT SETTLEMENT RECEIPT) Tj`);
  streamLines.push('ET');

  // Header Right Box: Receipt Number & Status
  streamLines.push('q');
  streamLines.push('0.957 0.941 0.922 rg'); // Warm white box #F4F0EB
  streamLines.push('0.867 0.839 0.796 RG'); // Subtle border #DDD6CB
  streamLines.push('0.75 w');
  streamLines.push('355 760 200 52 re B'); // Fill & Stroke
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push('1 0 0 1 367 798 Tm');
  streamLines.push(`(RECEIPT IDENTIFIER) Tj`);

  streamLines.push('/F1 11 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push('1 0 0 1 367 784 Tm');
  streamLines.push(`(${escapePdfText(receiptNumber)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.208 0.463 0.353 rg'); // Green #35765A
  streamLines.push('1 0 0 1 367 770 Tm');
  streamLines.push(`([x] STATUS: ON-CHAIN CONFIRMED) Tj`);
  streamLines.push('ET');

  // Top Divider line
  streamLines.push('q');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.75 w');
  streamLines.push('40 745 m 555 745 l S');
  streamLines.push('Q');

  // SECTION 1: ASSET SPECIFICATIONS
  let y = 724;
  streamLines.push('BT');
  streamLines.push('/F1 10.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 40 ${y} Tm`);
  streamLines.push(`(1. ASSET DOSSIER & CUSTODIAL SPECIFICATIONS) Tj`);
  streamLines.push('ET');

  // Section 1 Box
  y -= 75;
  streamLines.push('q');
  streamLines.push('0.988 0.984 0.980 rg');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.75 w');
  streamLines.push(`40 ${y} 515 65 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  // Column 1
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 48} Tm`);
  streamLines.push(`(ASSET NAME) Tj`);
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 36} Tm`);
  streamLines.push(`(${escapePdfText(assetName.slice(0, 40))}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 20} Tm`);
  streamLines.push(`(ASSET IDENTIFIER) Tj`);
  streamLines.push('/F3 9 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 8} Tm`);
  streamLines.push(`(${escapePdfText(assetId)}) Tj`);

  // Column 2
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 240 ${y + 48} Tm`);
  streamLines.push(`(CATEGORY & LOCATION) Tj`);
  streamLines.push('/F2 9.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 240 ${y + 36} Tm`);
  streamLines.push(`(${escapePdfText(category)} | ${escapePdfText(location.slice(0, 26))}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 240 ${y + 20} Tm`);
  streamLines.push(`(AUTHORIZED CUSTODIAN) Tj`);
  streamLines.push('/F2 9.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 240 ${y + 8} Tm`);
  streamLines.push(`(${escapePdfText(custodian.slice(0, 35))}) Tj`);

  // Column 3
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 430 ${y + 48} Tm`);
  streamLines.push(`(APPRAISED VALUATION) Tj`);
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push(`1 0 0 1 430 ${y + 36} Tm`);
  streamLines.push(`(${escapePdfText(valuation)}) Tj`);
  streamLines.push('ET');

  // SECTION 2: TOKENIZED SMART CONTRACT PARAMETERS
  y -= 30;
  streamLines.push('BT');
  streamLines.push('/F1 10.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 40 ${y} Tm`);
  streamLines.push(`(2. TOKENIZED DEED & CONTRACT PARAMETERS) Tj`);
  streamLines.push('ET');

  y -= 75;
  streamLines.push('q');
  streamLines.push('0.988 0.984 0.980 rg');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.75 w');
  streamLines.push(`40 ${y} 515 65 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  // Row 1
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 48} Tm`);
  streamLines.push(`(TOKEN STANDARD & TOKEN ID) Tj`);
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 36} Tm`);
  streamLines.push(`(ERC-721 Deed Token #${escapePdfText(tokenId)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 310 ${y + 48} Tm`);
  streamLines.push(`(BLOCKCHAIN NETWORK) Tj`);
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 310 ${y + 36} Tm`);
  streamLines.push(`(${escapePdfText(networkName)} [Chain ID: ${escapePdfText(chainId)}]) Tj`);

  // Row 2
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 20} Tm`);
  streamLines.push(`(ASSET TOKEN CONTRACT) Tj`);
  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 8} Tm`);
  streamLines.push(`(${escapePdfText(tokenContract)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 310 ${y + 20} Tm`);
  streamLines.push(`(MARKETPLACE CONTRACT) Tj`);
  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 310 ${y + 8} Tm`);
  streamLines.push(`(${escapePdfText(marketplaceContract)}) Tj`);
  streamLines.push('ET');

  // SECTION 3: SETTLEMENT PARTICIPANTS & CONSIDERATION
  y -= 30;
  streamLines.push('BT');
  streamLines.push('/F1 10.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 40 ${y} Tm`);
  streamLines.push(`(3. FINANCIAL CONSIDERATION & PARTICIPANTS) Tj`);
  streamLines.push('ET');

  y -= 95;
  streamLines.push('q');
  streamLines.push('0.988 0.984 0.980 rg');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.75 w');
  streamLines.push(`40 ${y} 515 85 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  // Price Highlight Box
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 68} Tm`);
  streamLines.push(`(PURCHASE CONSIDERATION) Tj`);
  streamLines.push('/F1 15 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push(`1 0 0 1 52 ${y + 51} Tm`);
  streamLines.push(`(${escapePdfText(priceEth)} ${escapePdfText(currency)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 240 ${y + 68} Tm`);
  streamLines.push(`(SETTLEMENT TIMESTAMP [UTC]) Tj`);
  streamLines.push('/F2 9.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 240 ${y + 53} Tm`);
  streamLines.push(`(${escapePdfText(formattedDate)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 430 ${y + 68} Tm`);
  streamLines.push(`(GAS & BLOCK CONFIRMATION) Tj`);
  streamLines.push('/F2 9.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 430 ${y + 53} Tm`);
  streamLines.push(`(Block #${escapePdfText(blockNumber)} | ${escapePdfText(gasFee)}) Tj`);

  // Parties
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 32} Tm`);
  streamLines.push(`(BUYER WALLET [NEW TITLE HOLDER]) Tj`);
  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 20} Tm`);
  streamLines.push(`(${escapePdfText(buyerWallet)}) Tj`);

  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 8} Tm`);
  streamLines.push(`(SELLER WALLET [PRIOR OWNER]) Tj`);
  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 200 ${y + 8} Tm`);
  streamLines.push(`(${escapePdfText(sellerWallet)}) Tj`);
  streamLines.push('ET');

  // SECTION 4: CRYPTOGRAPHIC AUDIT PROOF
  y -= 30;
  streamLines.push('BT');
  streamLines.push('/F1 10.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 40 ${y} Tm`);
  streamLines.push(`(4. CRYPTOGRAPHIC PROOF & CONSENSUS AUDIT) Tj`);
  streamLines.push('ET');

  y -= 60;
  streamLines.push('q');
  streamLines.push('0.957 0.941 0.922 rg'); // Light warm box
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.75 w');
  streamLines.push(`40 ${y} 515 50 re B`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 52 ${y + 34} Tm`);
  streamLines.push(`(ON-CHAIN TRANSACTION HASH [SEPOLIA IMMUTABLE LEDGER]) Tj`);

  streamLines.push('/F3 8.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 52 ${y + 22} Tm`);
  streamLines.push(`(${escapePdfText(transactionHash)}) Tj`);

  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.721 0.451 0.306 rg');
  streamLines.push(`1 0 0 1 52 ${y + 8} Tm`);
  streamLines.push(`(SEPOLIA EXPLORER: ${escapePdfText(etherscanUrl.slice(0, 75))}) Tj`);
  streamLines.push('ET');

  // LEGAL FOOTER
  y -= 38;
  streamLines.push('q');
  streamLines.push('0.867 0.839 0.796 RG');
  streamLines.push('0.5 w');
  streamLines.push(`40 ${y} m 555 ${y} l S`);
  streamLines.push('Q');

  y -= 22;
  streamLines.push('BT');
  streamLines.push('/F2 7.5 Tf');
  streamLines.push('0.467 0.463 0.435 rg');
  streamLines.push(`1 0 0 1 40 ${y} Tm`);
  streamLines.push(`(This document constitutes official, verifiable proof of title acquisition executed through Assetra Protocol smart contracts.) Tj`);

  streamLines.push(`1 0 0 1 40 ${y - 10} Tm`);
  streamLines.push(`(Payment was forwarded atomically to the seller and token ownership transferred directly to the buyer's wallet upon block consensus.) Tj`);

  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.125 0.129 0.121 rg');
  streamLines.push(`1 0 0 1 40 ${y - 24} Tm`);
  streamLines.push(`(Assetra Protocol Digital Ledger Verification Engine - Document Authenticated - Page 1 of 1) Tj`);
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
 * Creates a downloadable binary Blob for the receipt.
 */
export function generateReceiptPdfBlob(receiptData = {}) {
  const pdfString = buildReceiptPdfString(receiptData);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(pdfString);
  return new Blob([uint8Array], { type: 'application/pdf' });
}

/**
 * Triggers browser download of the PDF receipt file.
 */
export function downloadReceiptPdf(receiptData = {}) {
  const blob = generateReceiptPdfBlob(receiptData);
  const receiptNumber = receiptData.receiptNumber || generateReceiptNumber(receiptData.transactionHash);
  const filename = `Assetra-Receipt-${receiptNumber}.pdf`;

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
 * Opens PDF receipt in a new browser tab for immediate previewing or printing.
 */
export function openReceiptPdfInNewTab(receiptData = {}) {
  const blob = generateReceiptPdfBlob(receiptData);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
