/**
 * Global Express error handler.
 * Must have exactly 4 parameters so Express recognises it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status} ${message}`);
    if (status === 500) console.error(err.stack);
  }

  return res.status(status).json({
    success: false,
    message,
    // Never leak stack traces in production
    ...(process.env.NODE_ENV !== "production" && status === 500 && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
