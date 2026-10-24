const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  let message = err.message || 'Internal Server Error';

  if (err.code === 'ENOTFOUND') {
    message = `Database Host Not Found: Cannot resolve database host "${err.hostname || 'Ip'}". Please check DATABASE_URL in Vercel Environment Variables.`;
  } else if (err.code === 'ECONNREFUSED') {
    message = `Database Connection Refused: Cannot connect to database server. Please check port and connection string.`;
  } else if (err.code === '28P01') {
    message = `Database Authentication Failed: Invalid database username or password.`;
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
