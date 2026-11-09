require('express-async-errors');
const express = require('express');
require('dotenv').config();
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const favicon = require('serve-favicon');

const app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-monitoring-key'],
}));
app.use(express.json());
app.use(morgan('dev'));

// Read-only scraper health API. Set SCRAPER_MONITORING_API_KEY in production
// before exposing operational metrics outside a trusted network.
app.use('/api/monitoring', require('./monitoring/routes'));

const PORT = process.env.PORT || 9000;

const startAllJobs = async () => {
  console.log('='.repeat(60));
  console.log('🚀 Starting All Scraper Jobs');
  console.log('='.repeat(60));

  try {
    require('./jobs/forex.job');
    console.log('✅ Forex job loaded');
    require('./jobs/interbank.job');
    console.log('✅ Forex Interbank job loaded');
    require('./jobs/commodities.job');
    console.log('✅ Commodity job loaded');
    require('./jobs/crypto.job');
    console.log('✅ Crypto job loaded');
    require('./jobs/indice.job');
    console.log('✅ Index job loaded');
    require('./jobs/stocks/caps');
    console.log('✅ GSE Stocks Fundamental job loaded');
    require('./jobs/stocks/base');
    console.log('✅ GSE Stocks Live job loaded');
    require('./jobs/marketStatus.job');
    console.log('✅ GSE Market Status job loaded');
    console.log('='.repeat(60));
    console.log('✅ All scraper jobs started successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error starting jobs:', error.message);
  }
};

app.use((err, req, res, next) => {
  console.error('[http] Request failed:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startAllJobs();
});
