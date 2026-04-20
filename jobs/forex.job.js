const cron = require('node-cron');
const axios = require('axios');
const forexSources = require('../scripts/forexIndex');

const MAX_WAIT_MS = 10 * 60 * 1000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:6060/api';

const getUTCHour = () => {
  const now = new Date();
  return now.getUTCHours();
};

const getUTCDay = () => {
  const now = new Date();
  return now.getUTCDay();
};

async function forexExists(code) {
  try {
    const response = await axios.get(`${API_BASE_URL}/forex/${code}`, {
      timeout: 60000,
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

async function createForexViaAPI(forexData) {
  const payload = {
    code: forexData.code,
    name: forexData.name,
    from_currency: forexData.from_currency,
    from_code: forexData.from_code,
    to_currency: forexData.to_currency,
    to_code: forexData.to_code,
    currentPrice: forexData.currentPrice,
    percentage_change: forexData.percentage_change || 0,
    monthly_change: forexData.monthly_change || 0,
    yearly_change: forexData.yearly_change || 0,
  };

  const response = await axios.post(`${API_BASE_URL}/forex`, payload, {
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
}

async function updateForexPriceViaAPI(
  code,
  newPrice,
  percentageChange,
  monthlyChange,
  yearlyChange,
) {
  const payload = {
    currentPrice: newPrice,
    percentage_change: percentageChange || 0,
    monthly_change: monthlyChange || 0,
    yearly_change: yearlyChange || 0,
    last_updated: new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/forex/${code}/price`,
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
    `${API_BASE_URL}/forex/${code}/entries`,
    payload,
    {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}

const processForexUpdate = async (scrapedData) => {
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

  let {
    code,
    name,
    from_currency,
    from_code,
    to_currency,
    to_code,
    currentPrice,
    percentage_change,
    monthly_change,
    yearly_change,
  } = scrapedData;

  if (!currentPrice && scrapedData.price) {
    currentPrice = scrapedData.price;
  }

  if (!percentage_change && scrapedData.percentage_change) {
    percentage_change = scrapedData.percentage_change;
  }

  try {
    if (!code) {
      throw new Error(`Missing code for forex pair`);
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

    const existingForex = await forexExists(code);

    if (!existingForex) {
      await createForexViaAPI({
        code,
        name: name || code,
        from_currency: from_currency || code.slice(0, 3),
        from_code: from_code || code.slice(0, 3),
        to_currency: to_currency || code.slice(3, 6),
        to_code: to_code || code.slice(3, 6),
        currentPrice,
        percentage_change: percentage_change || 0,
        monthly_change: monthly_change || 0,
        yearly_change: yearly_change || 0,
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

    const oldPrice = existingForex.data.currentPrice;

    await addPriceEntryToHistory(code, oldPrice);
    await updateForexPriceViaAPI(
      code,
      currentPrice,
      percentage_change || 0,
      monthly_change || 0,
      yearly_change || 0,
    );

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

const forexUpdateJob = cron.schedule(
  '*/5 * * * *',
  async () => {
    const utcHour = getUTCHour();
    const utcDay = getUTCDay();

    if (utcDay === 0 || utcDay === 6) {
      console.log(`[${new Date().toISOString()}] Skipping: Weekend`);
      return;
    }

    console.log(
      `\n[${new Date().toISOString()}] 🔄 Starting forex update job...`,
    );

    try {
      const scrapedData = await Promise.all(
        forexSources.map(async (scraperFn) => {
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

      console.log(`📊 Processing ${validData.length} forex pairs...`);

      const results = await Promise.all(validData.map(processForexUpdate));

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

module.exports = forexUpdateJob;
