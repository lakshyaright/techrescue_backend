const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const queryRoutes = require('./src/routes/queryRoutes');
const expertRoutes = require('./src/routes/expertRoutes');
const engineerRoutes = require('./src/routes/engineerRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy headers (Mandatory for Azure Application Gateway & Nginx)
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint for Azure Application Gateway probe & uptime checks
const healthHandler = async (req, res) => {
  try {
    // Optional lightweight DB ping
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'OK',
      service: 'techrescue-backend-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      gateway: req.headers['x-forwarded-for'] ? 'routed-via-application-gateway' : 'direct',
    });
  } catch (err) {
    // If DB is temporarily connecting, still return 200 with degraded note for probe pass or 503
    res.status(200).json({
      status: 'DEGRADED',
      service: 'techrescue-backend-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'reconnecting',
      error: err.message,
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TechRescue Enterprise IT Support & Marketplace API',
    version: '1.0.0',
    status: 'ONLINE',
    docs: '/api/v1',
  });
});

// Mount API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/queries', queryRoutes);
app.use('/api/v1/experts', expertRoutes);
app.use('/api/v1/engineers', engineerRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Centralized error handling
app.use(errorHandler);

// Start server on 0.0.0.0 for Azure VM listening
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TechRescue Backend] Server listening on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app;
