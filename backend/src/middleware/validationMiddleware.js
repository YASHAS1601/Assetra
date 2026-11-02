const validateAssetInput = (req, res, next) => {
  const { name, category, valuation } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Asset name is required and must be a valid string.'
    });
  }

  if (valuation === undefined || isNaN(Number(valuation)) || Number(valuation) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Appraised valuation must be a positive numerical value.'
    });
  }

  const { currency } = req.body;
  if (currency && typeof currency === 'string') {
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'ETH'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid currency code '${currency}'. Allowed currencies: ${validCurrencies.join(', ')}.`
      });
    }
  }

  next();
};

module.exports = {
  validateAssetInput
};
