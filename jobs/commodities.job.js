const cron = require('node-cron');
const mongoose = require('mongoose');
const Commodity = require('../models/commodity.model');
const commoditySources = require('../scripts/commoditiesIndex');

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const getETHour = () => {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  ).getHours();
};
const getETDay = () => {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  ).getDay();
};

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
    ),
  ]);
};

const processCommodityUpdate = async (data) => {
  const start = Date.now();
  try {
    if (typeof data.currentPrice !== 'number' || isNaN(data.currentPrice)) {
      throw new Error(`Invalid currentPrice: ${data.currentPrice}`);
    }

    const existing = await Commodity.findOne({ code: data.code }).lean();

    if (!existing) {
      await Commodity.create({
        code: data.code,
        name: data.name,
        unit: data.unit,
        category: data.category,
        currentPrice: data.currentPrice,
        percentage_change: data.percentage_change,
        price_history: data.price_history || [],
        last_updated: new Date(),
      });
      return {
        code: data.code,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    const existingPrice = Number(existing.currentPrice);
    if (isNaN(existingPrice)) {
      throw new Error(`Existing price is invalid: ${existing.currentPrice}`);
    }

    await Commodity.updateOne(
      { code: data.code },
      {
        $set: {
          currentPrice: data.currentPrice,
          percentage_change: data.percentage_change,
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [{ date: new Date(), price: existingPrice }],
            $position: 0,
          },
        },
      },
    );

    return {
      code: data.code,
      action: 'updated',
      oldPrice: existingPrice,
      newPrice: data.currentPrice,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { code: data.code, error: error.message };
  }
};

const commodityUpdateJob = cron.schedule(
  '0 * * * *',
  async () => {
    const etHour = getETHour();
    const etDay = getETDay();

    if (etDay === 6 || etHour === 17) {
      return;
    }

    if (!checkConnection()) {
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(commoditySources)
        ? commoditySources
        : Object.values(commoditySources);

      const scrapedData = await Promise.all(
        scrapers.map((scraper) =>
          withTimeout(
            scraper(),
            MAX_WAIT_MS,
            scraper.name || 'anonymous',
          ).catch((error) => ({ error: error.message })),
        ),
      );

      const validData = scrapedData.filter((data) => data?.code && !data.error);

      await Promise.all(validData.map(processCommodityUpdate));
    } catch (error) {}
  },
  {
    scheduled: true,
    timezone: 'UTC',
  },
);

module.exports = commodityUpdateJob;
