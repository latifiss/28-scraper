const cron = require('node-cron');
const axios = require('axios');
const commoditySources = require('../scripts/commoditiesIndex');

const MAX_WAIT_MS = 10 * 60 * 1000;
const API_BASE_URL =
  process.env.API_BASE_URL || 'https://api.28-markets.com/api';

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

async function commodityExists(code) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/commodity/commodities/${code}`,
      {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createCommodityViaAPI(commodityData) {
  const payload = {
    code: commodityData.code,
    name: commodityData.name,
    unit: commodityData.unit,
    category: commodityData.category,
    currentPrice: commodityData.currentPrice,
    percentage_change: commodityData.percentage_change || 0,
  };

  const response = await axios.post(
    `${API_BASE_URL}/commodity/commodities`,
    payload,
    {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

async function updateCurrentPriceOnly(code, newPrice, percentageChange) {
  const payload = {
    price: newPrice,
    percentage_change: percentageChange || 0,
    last_updated: new Date().toISOString(),
  };

  const response = await axios.put(
    `${API_BASE_URL}/commodity/commodities/${code}/latest`,
    payload,
    {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

async function addPriceEntryToHistory(code, price, date = null) {
  const payload = {
    price: price,
    date: date || new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/commodity/commodities/${code}/entries`,
    payload,
    {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

const processCommodityUpdate = async (scrapedData) => {
  const start = Date.now();

  if (!scrapedData || scrapedData.error) {
    console.log(
      `  ⚠️  Skipping invalid data: ${scrapedData?.error || 'No data'}`,
    );
    return {
      code: scrapedData?.code || 'unknown',
      error: scrapedData?.error || 'No data',
      skipped: true,
    };
  }

  let { code, name, unit, category, currentPrice, percentage_change } =
    scrapedData;

  if (!currentPrice && scrapedData.price) {
    currentPrice = scrapedData.price;
  }

  if (!percentage_change && scrapedData.percentage_change) {
    percentage_change = scrapedData.percentage_change;
  }

  try {
    if (!code) {
      throw new Error(`Missing code for commodity`);
    }

    if (typeof currentPrice !== 'number' || isNaN(currentPrice)) {
      console.log(
        `  ⚠️  Skipping ${code}: Invalid price received (${currentPrice})`,
      );
      return {
        code,
        error: `Invalid price: ${currentPrice}`,
        skipped: true,
      };
    }

    const existingCommodity = await commodityExists(code);

    if (!existingCommodity) {
      await createCommodityViaAPI({
        code,
        name: name || code,
        unit: unit || 'unit',
        category: category || 'Other',
        currentPrice,
        percentage_change: percentage_change || 0,
      });

      await addPriceEntryToHistory(code, currentPrice);

      console.log(`  ✅ Created ${code} with price ${currentPrice}`);

      return {
        code,
        action: 'created',
        historyAdded: true,
        duration: Date.now() - start,
      };
    }

    const oldPrice = existingCommodity.data.currentPrice;

    await addPriceEntryToHistory(code, oldPrice);
    await updateCurrentPriceOnly(code, currentPrice, percentage_change || 0);

    if (oldPrice !== currentPrice) {
      console.log(`  📝 Updated ${code}: ${oldPrice} → ${currentPrice}`);
    } else {
      console.log(
        `  📝 Added history entry for ${code}: price unchanged at ${currentPrice}`,
      );
    }

    return {
      code,
      action: 'updated',
      oldPrice: oldPrice,
      newPrice: currentPrice,
      historyAdded: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    console.error(`  ❌ Failed ${code}:`, error.message);
    if (error.response?.data) {
      console.error(`  📄 Response data:`, error.response.data);
    }
    return {
      code,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

const commodityUpdateJob = cron.schedule(
  '*/5 * * * *',
  async () => {
    const etHour = getETHour();
    const etDay = getETDay();

    if (etDay === 6 || etHour === 17) {
      console.log(`[${new Date().toISOString()}] Skipping: Saturday or 5PM ET`);
      return;
    }

    console.log(
      `\n[${new Date().toISOString()}] 🔄 Starting commodity update job...`,
    );

    try {
      const scrapedData = await Promise.all(
        commoditySources.map(async (scraperFn) => {
          try {
            const result = await scraperFn();
            return result;
          } catch (err) {
            console.error(`Scraper error for ${scraperFn.name}:`, err.message);
            return { error: err.message };
          }
        }),
      );

      console.log(
        `📊 Raw scraped data:`,
        scrapedData.map((d) => ({
          code: d?.code,
          price: d?.price || d?.currentPrice,
          name: d?.name,
          error: d?.error,
        })),
      );

      const validData = scrapedData.filter(
        (data) =>
          data?.code &&
          !data.error &&
          (typeof data.currentPrice === 'number' ||
            typeof data.price === 'number'),
      );

      console.log(`📊 Processing ${validData.length} commodities...`);

      const results = await Promise.all(validData.map(processCommodityUpdate));

      const successful = results.filter((r) => !r.error && !r.skipped).length;
      const failed = results.filter((r) => r.error).length;
      const skipped = results.filter((r) => r.skipped).length;
      const historyAdded = results.filter((r) => r.historyAdded).length;

      console.log(`[${new Date().toISOString()}] ✅ Job completed:`);
      console.log(`  ✅ Successful: ${successful}`);
      console.log(`  ❌ Failed: ${failed}`);
      console.log(`  ⏭️  Skipped: ${skipped}`);
      console.log(`  📝 History entries added: ${historyAdded}`);

      results
        .filter((r) => r.error)
        .forEach((failure) => {
          console.error(`  ❌ ${failure.code}: ${failure.error}`);
        });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ❌ Job failed:`,
        error.message,
      );
    }
  },
  {
    scheduled: true,
    timezone: 'UTC',
  },
);

module.exports = commodityUpdateJob;
