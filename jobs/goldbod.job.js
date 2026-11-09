const cron = require('node-cron');
const mongoose = require('mongoose');
const Goldbod = require('../models/golbod.model');
const scrapeGoldPriceRaw = require('../scripts/goldbod/gold');
const { monitored } = require('../monitoring');

const scrapeGoldPrice = monitored({
  id: 'goldbod-gold-price',
  name: 'GoldBod gold price',
  category: 'goldbod',
  source: 'GoldBod',
  expectedIntervalMs: 24 * 60 * 60 * 1000,
  staleAfterMs: 48 * 60 * 60 * 1000,
}, scrapeGoldPriceRaw);

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const withTimeout = (promise, timeoutMs, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs)),
]);

const processGoldbodUpdate = async (data) => {
  const start = Date.now();
  try {
    const priceRaw = data?.price_per_gh_pound;
    if (!priceRaw) throw new Error('No price data received from scraper');
    const numericPrice = parseFloat(priceRaw.replace(/[^\d.]/g, ''));
    if (isNaN(numericPrice)) throw new Error(`Invalid price: ${priceRaw}`);
    const existing = await Goldbod.findOne({ code: 'goldbod' }).lean();
    if (!existing) {
      await Goldbod.create({ currentPrice: numericPrice, percentage_change: 0, price_history: [], last_updated: new Date() });
      return { code: 'goldbod', action: 'created', duration: Date.now() - start };
    }
    const existingPrice = Number(existing.currentPrice);
    if (isNaN(existingPrice)) throw new Error(`Existing price is invalid: ${existing.currentPrice}`);
    const percentageChange = ((numericPrice - existingPrice) / existingPrice) * 100;
    await Goldbod.updateOne({ code: 'goldbod' }, {
      $set: { currentPrice: numericPrice, percentage_change: percentageChange, last_updated: new Date() },
      $push: { price_history: { $each: [{ date: new Date(), price: existingPrice }], $position: 0 } },
    });
    return { code: 'goldbod', action: 'updated', oldPrice: existingPrice, newPrice: numericPrice, duration: Date.now() - start };
  } catch (error) {
    return { code: 'goldbod', error: error.message };
  }
};

const goldbodUpdateJob = cron.schedule('0 0 * * 1-5', async () => {
  if (!checkConnection()) return;
  try {
    let scrapedData;
    try {
      scrapedData = await withTimeout(scrapeGoldPrice(), MAX_WAIT_MS, 'goldbodScraper');
      if (!scrapedData || typeof scrapedData !== 'object' || scrapedData.error) {
        throw new Error(scrapedData?.error || 'Invalid scraper response');
      }
      if (!scrapedData.price_per_gh_pound) throw new Error('GoldBod returned no price_per_gh_pound');
    } catch (err) {
      console.error('[goldbod] Scraper failed:', err.message);
      return;
    }
    await processGoldbodUpdate(scrapedData);
  } catch (error) {
    console.error('[goldbod] Update failed:', error.message);
  }
}, { scheduled: false, timezone: 'UTC' });

module.exports = goldbodUpdateJob;
