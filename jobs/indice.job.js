const cron = require('node-cron');
const axios = require('axios');
const indexSources = require('../scripts/indicesIndex');

const MAX_WAIT_MS = 10000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:6060/api';

const getGhanaTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Accra' }));
};

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
    ),
  ]);
};

async function indexExists(code) {
  try {
    const response = await axios.get(`${API_BASE_URL}/index/indices/${code}`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createIndexViaAPI(indexData) {
  const payload = {
    code: indexData.code,
    symbol: indexData.symbol,
    name: indexData.name,
    currentPrice: indexData.currentPrice,
    value_change: indexData.value_change,
    percentage_change: indexData.percentage_change,
    monthly_change: indexData.monthly_change || 0,
    yearly_change: indexData.yearly_change || 0,
  };

  const response = await axios.post(`${API_BASE_URL}/index/indices`, payload, {
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
}

async function updateIndexPriceViaAPI(code, indexData) {
  const payload = {
    currentPrice: indexData.currentPrice,
    value_change: indexData.value_change,
    percentage_change: indexData.percentage_change,
    monthly_change: indexData.monthly_change,
    yearly_change: indexData.yearly_change,
    date: new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/index/indices/${code}/price`,
    payload,
    {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

async function updateFullIndexViaAPI(code, indexData) {
  const payload = {
    symbol: indexData.symbol,
    name: indexData.name,
    currentPrice: indexData.currentPrice,
    value_change: indexData.value_change,
    percentage_change: indexData.percentage_change,
    monthly_change: indexData.monthly_change,
    yearly_change: indexData.yearly_change,
    last_updated: new Date().toISOString(),
  };

  const response = await axios.put(
    `${API_BASE_URL}/index/indices/${code}`,
    payload,
    {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

async function addHistoryEntryViaAPI(code, price, date = null) {
  const payload = {
    price: price,
    date: date || new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/index/indices/${code}/history`,
    payload,
    {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

async function getIndexHistory(code) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/index/indices/${code}/history`,
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { price_history: [] };
    }
    throw error;
  }
}

const processIndexUpdate = async (scrapedData) => {
  const start = Date.now();
  const {
    code,
    symbol,
    name,
    currentPrice,
    value_change,
    percentage_change,
    monthly_change,
    yearly_change,
  } = scrapedData;

  try {
    if (typeof currentPrice !== 'number' || isNaN(currentPrice)) {
      throw new Error(`Invalid currentPrice: ${currentPrice}`);
    }

    const existingIndex = await indexExists(code);

    if (!existingIndex) {
      await createIndexViaAPI({
        code,
        symbol,
        name,
        currentPrice,
        value_change,
        percentage_change,
        monthly_change,
        yearly_change,
      });

      console.log(`  ✅ Created ${code} with initial price ${currentPrice}`);

      return {
        code,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    const oldPrice = existingIndex.data.currentPrice;

    await updateIndexPriceViaAPI(code, {
      currentPrice,
      value_change,
      percentage_change,
      monthly_change,
      yearly_change,
    });

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

const indexUpdateJob = cron.schedule(
  '*/2 * * * *',
  async () => {
    const ghanaTime = getGhanaTime();
    const hour = ghanaTime.getHours();
    const day = ghanaTime.getDay();

    console.log(
      `\n[${ghanaTime.toISOString()}] 🔄 Starting index update job...`,
    );
    console.log(`  Day: ${day}, Hour: ${hour}`);

    try {
      const scrapers = Array.isArray(indexSources)
        ? indexSources
        : Object.values(indexSources);

      const scrapedData = await Promise.all(
        scrapers
          .filter(Boolean)
          .map((scraper) =>
            withTimeout(
              scraper(),
              MAX_WAIT_MS,
              scraper.name || 'anonymous',
            ).catch((err) => ({ error: err.message })),
          ),
      );

      console.log(
        `📊 Raw scraped data:`,
        scrapedData.map((d) => ({
          code: d?.code,
          price: d?.currentPrice,
          name: d?.name,
          error: d?.error,
        })),
      );

      let validData = scrapedData.filter(
        (d) => d?.code && !d.error && d.currentPrice,
      );

      validData = validData.filter((d) => {
        if (d.code === 'GGSECI') {
          if (day === 0 || day === 6) {
            console.log(`  ⏭️  Skipping ${d.code}: Weekend`);
            return false;
          }
          if (hour < 10 || hour > 15) {
            console.log(
              `  ⏭️  Skipping ${d.code}: Outside trading hours (${hour}:00)`,
            );
            return false;
          }
        }
        return true;
      });

      console.log(`📊 Processing ${validData.length} indices...`);

      const results = await Promise.all(validData.map(processIndexUpdate));

      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;

      console.log(`[${ghanaTime.toISOString()}] ✅ Job completed:`);
      console.log(`  ✅ Successful: ${successful}`);
      console.log(`  ❌ Failed: ${failed}`);

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

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down index scraper service...');
  indexUpdateJob.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down index scraper service...');
  indexUpdateJob.stop();
  process.exit(0);
});

module.exports = indexUpdateJob;
