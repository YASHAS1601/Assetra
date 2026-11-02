/**
 * Assetra Supported Currencies & Formatting Utilities
 * Provides ISO currency codes, symbols, options for dropdowns, and formatting
 * using standard international conventions (including Indian numbering system for INR).
 */

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'USD ($)', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)', name: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)', name: 'British Pound' },
  { code: 'ETH', symbol: 'Ξ', label: 'ETH (Ξ)', name: 'Ethereum' }
];

export const DEFAULT_CURRENCY = 'INR';

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export const isValidCurrency = (code) => {
  if (!code || typeof code !== 'string') return false;
  return CURRENCY_CODES.includes(code.toUpperCase());
};

/**
 * Format numeric valuation according to ISO currency code standards.
 * For INR: Uses the Indian numbering system (en-IN locale) e.g. 7500000 -> ₹75,00,000
 *
 * @param {number|string} amount - The numeric or string valuation amount
 * @param {string} currencyCode - ISO currency code (default: 'INR')
 * @returns {string} Formatted currency display value
 */
export const formatCurrency = (amount, currencyCode = DEFAULT_CURRENCY) => {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';

  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  const isWhole = num % 1 === 0;

  if (code === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2
    }).format(num);
  }

  if (code === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2
    }).format(num);
  }

  if (code === 'EUR') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2
    }).format(num);
  }

  if (code === 'GBP') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2
    }).format(num);
  }

  if (code === 'ETH') {
    return `Ξ${num.toLocaleString('en-US', {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 4
    })}`;
  }

  // Fallback for any other valid ISO currency
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2
    }).format(num);
  } catch {
    return `${code} ${num.toLocaleString()}`;
  }
};
