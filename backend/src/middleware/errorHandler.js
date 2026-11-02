const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err.message || err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the Assetra backend service.',
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
