require('express-async-errors');
const express = require('express');
require('dotenv').config();
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const favicon = require('serve-favicon');

const app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());
app.use(morgan('dev'));

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 9000;

const startAllJobs = async () => {
  console.log('='.repeat(60));
  console.log('🚀 Starting All Scraper Jobs');
  console.log('='.repeat(60));

  try {
    const forexJob = require('./jobs/forex.job');
    console.log('✅ Forex job loaded');

    const forexInterbankJob = require('./jobs/interbank.job');
    console.log('✅ Forex Interbank job loaded');

    const commodityJob = require('./jobs/commodities.job');
    console.log('✅ Commodity job loaded');

    const cryptoJob = require('./jobs/crypto.job');
    console.log('✅ Crypto job loaded');

    const indexJob = require('./jobs/indice.job');
    console.log('✅ Index job loaded');

    const gseStocksFundamentalJob = require('./jobs/stocks/caps');
    console.log('✅ GSE Stocks Fundamental job loaded');

    const gseStocksLiveJob = require('./jobs/stocks/base');
    console.log('✅ GSE Stocks Live job loaded');

    const gseMarketStatusJob = require('./jobs/marketStatus.job');
    console.log('✅ GSE Market Status job loaded');

    console.log('='.repeat(60));
    console.log('✅ All scraper jobs started successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error starting jobs:', error.message);
  }
};

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startAllJobs();
});
