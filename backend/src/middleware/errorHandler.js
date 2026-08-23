export function errorHandler(err, req, res, next) {
  console.error(err); // Full error logged server-side for debugging

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Something went wrong on our end';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
    },
  });
}