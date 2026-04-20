const cron = require('node-cron');
const mongoose = require('mongoose');
const ForexInterbank = require('../models/forexInterbank.model');
const interbankScraper = require('../scripts/forex/interbank');

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
    ),
  ]);
};

const currencyMap = {
  USD: { name: 'US Dollar', currency: 'US Dollar' },
  EUR: { name: 'Euro', currency: 'Euro' },
  GBP: { name: 'British Pound', currency: 'British Pound Sterling' },
  CAD: { name: 'Canadian Dollar', currency: 'Canadian Dollar' },
  AUD: { name: 'Australian Dollar', currency: 'Australian Dollar' },
  JPY: { name: 'Japanese Yen', currency: 'Japanese Yen' },
  CHF: { name: 'Swiss Franc', currency: 'Swiss Franc' },
  CNY: { name: 'Chinese Yuan', currency: 'Chinese Yuan' },
  GHS: { name: 'Ghanaian Cedi', currency: 'Ghana Cedi' },
  NGN: { name: 'Nigerian Naira', currency: 'Nigerian Naira' },
  ZAR: { name: 'South African Rand', currency: 'South African Rand' },
  XOF: { name: 'West African CFA Franc', currency: 'CFA Franc BCEAO' },
  XAF: { name: 'Central African CFA Franc', currency: 'CFA Franc BEAC' },
};

const getCurrencyInfo = (code) => {
  return (
    currencyMap[code] || {
      name: code,
      currency: code,
    }
  );
};

const transformScrapedData = (scrapedRate) => {
  const currencyPair = scrapedRate.currencyPair.trim();

  let fromCode, toCode;

  if (currencyPair.includes('/')) {
    const parts = currencyPair.split('/');
    fromCode = parts[0].trim().toUpperCase();
    toCode = parts[1].trim().toUpperCase();
  } else if (currencyPair.includes(' ')) {
    const parts = currencyPair.split(' ');
    fromCode = parts[0].trim().toUpperCase();
    toCode = parts[1].trim().toUpperCase();
  } else {
    fromCode = currencyPair.substring(0, 3).toUpperCase();
    toCode = currencyPair.substring(3).toUpperCase();
  }

  const fromInfo = getCurrencyInfo(fromCode);
  const toInfo = getCurrencyInfo(toCode);

  const code = `${fromCode}${toCode}`;
  const bankCode = `BOG${code}`;
  const name = `${fromInfo.name} to ${toInfo.name}`;

  return {
    bankName: 'Bank of Ghana',
    bankCode: bankCode,
    code: code,
    name: name,
    from_currency: fromInfo.currency,
    from_code: fromCode,
    to_currency: toInfo.currency,
    to_code: toCode,
    current_buying_price: scrapedRate.buying,
    current_selling_price: scrapedRate.selling,
    current_midrate_price: scrapedRate.midRate,
    date: new Date(scrapedRate.date),
  };
};

const calculatePercentageChange = (oldValue, newValue) => {
  if (!oldValue || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

const processInterbankUpdate = async (data) => {
  const start = Date.now();
  try {
    const existing = await ForexInterbank.findOne({
      bankCode: data.bankCode,
    }).lean();

    const updateData = {
      current_buying_price: Number(data.current_buying_price),
      current_selling_price: Number(data.current_selling_price),
      current_midrate_price: Number(data.current_midrate_price),
      last_updated: new Date(),
    };

    if (existing) {
      updateData.buying_percentage_change = parseFloat(
        calculatePercentageChange(
          existing.current_buying_price,
          data.current_buying_price,
        ).toFixed(4),
      );
      updateData.selling_percentage_change = parseFloat(
        calculatePercentageChange(
          existing.current_selling_price,
          data.current_selling_price,
        ).toFixed(4),
      );
      updateData.midrate_percentage_change = parseFloat(
        calculatePercentageChange(
          existing.current_midrate_price,
          data.current_midrate_price,
        ).toFixed(4),
      );
    } else {
      updateData.buying_percentage_change = 0;
      updateData.selling_percentage_change = 0;
      updateData.midrate_percentage_change = 0;
    }

    const updateObject = {
      $set: {
        ...data,
        ...updateData,
      },
    };

    if (existing) {
      updateObject.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              buying_price: Number(existing.current_buying_price),
              selling_price: Number(existing.current_selling_price),
              midrate_price: Number(existing.current_midrate_price),
            },
          ],
          $position: 0,
        },
      };
    }

    const result = await ForexInterbank.findOneAndUpdate(
      { bankCode: data.bankCode },
      updateObject,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    return {
      code: data.code,
      bankCode: data.bankCode,
      action: existing ? 'updated' : 'created',
      duration: Date.now() - start,
      ...(existing && {
        oldBuying: existing.current_buying_price,
        newBuying: data.current_buying_price,
        oldSelling: existing.current_selling_price,
        newSelling: data.current_selling_price,
      }),
    };
  } catch (error) {
    return {
      code: data.code,
      bankCode: data.bankCode,
      error: error.message,
    };
  }
};

const interbankUpdateJob = cron.schedule(
  '0 0 * * 1-5',
  async () => {
    const runId = Date.now();

    if (!checkConnection()) {
      return;
    }

    const now = new Date();
    const startTime = Date.now();

    try {
      const scrapedResult = await withTimeout(
        interbankScraper(),
        MAX_WAIT_MS,
        'Bank of Ghana scraper',
      );

      if (scrapedResult.error) {
        return;
      }

      if (!scrapedResult.rates || scrapedResult.rates.length === 0) {
        return;
      }

      const transformedData = scrapedResult.rates
        .filter(
          (rate) =>
            rate.currencyPair && rate.buying && rate.selling && rate.midRate,
        )
        .map(transformScrapedData);

      const results = await Promise.all(
        transformedData.map(processInterbankUpdate),
      );
      const success = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);
    } catch (error) {}
  },
  {
    scheduled: true,
    timezone: 'UTC',
  },
);

module.exports = {
  interbankUpdateJob,
  runNow: async () => {
    await interbankUpdateJob.getTask()();
  },
  stop: () => {
    interbankUpdateJob.stop();
  },
  start: () => {
    interbankUpdateJob.start();
  },
  getStatus: () => {
    return {
      isRunning: interbankUpdateJob.getStatus() === 'started',
      nextRun: interbankUpdateJob.nextDates(),
      pattern: '0 0 * * 1-5',
      timezone: 'UTC',
    };
  },
};
