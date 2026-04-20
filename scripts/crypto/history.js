const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const fetchHistoricalData = async (coinId, days = 365, vsCurrency = 'usd') => {
  try {
    console.log(`Fetching ${days} days of historical data for ${coinId}...`);

    // Get coin details
    const coinDetails = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}`,
      {
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
        timeout: 10000,
      },
    );

    console.log(
      `Found coin: ${coinDetails.data.name} (${coinDetails.data.symbol.toUpperCase()})`,
    );

    // Fetch market chart data
    const marketChartResponse = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
      {
        params: {
          vs_currency: vsCurrency,
          days: Math.min(days, 365), // Free tier limit
          interval: days > 90 ? 'daily' : undefined,
        },
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
        timeout: 30000,
      },
    );

    // Format data to match your model structure
    const formattedData = {
      // Main crypto info (matching your ICrypto interface)
      crypto: {
        id: coinDetails.data.id,
        symbol: coinDetails.data.symbol,
        name: coinDetails.data.name,
        image: coinDetails.data.image?.large || coinDetails.data.image?.small,
        current_price:
          marketChartResponse.data.prices[
            marketChartResponse.data.prices.length - 1
          ]?.[1] || 0,
        market_cap:
          marketChartResponse.data.market_caps[
            marketChartResponse.data.market_caps.length - 1
          ]?.[1],
        total_volume:
          marketChartResponse.data.total_volumes[
            marketChartResponse.data.total_volumes.length - 1
          ]?.[1],
        price_history: marketChartResponse.data.prices.map(
          ([timestamp, price]) => ({
            date: new Date(timestamp),
            price: price,
          }),
        ),
        last_updated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Coin history data (matching your ICoinHistory interface)
      coin_history: {
        symbol: coinDetails.data.symbol,
        name: coinDetails.data.name,
        market_data: {
          prices: marketChartResponse.data.prices.map(([timestamp, price]) => ({
            timestamp: timestamp,
            price: price,
          })),
        },
        timeframe: days.toString(),
        vs_currency: vsCurrency,
        last_updated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Summary statistics
      summary: {
        total_data_points: marketChartResponse.data.prices.length,
        date_range: {
          from: new Date(marketChartResponse.data.prices[0][0]),
          to: new Date(
            marketChartResponse.data.prices[
              marketChartResponse.data.prices.length - 1
            ][0],
          ),
        },
        price_stats: {
          highest: Math.max(
            ...marketChartResponse.data.prices.map((p) => p[1]),
          ),
          lowest: Math.min(...marketChartResponse.data.prices.map((p) => p[1])),
          average:
            marketChartResponse.data.prices.reduce((sum, p) => sum + p[1], 0) /
            marketChartResponse.data.prices.length,
          start: marketChartResponse.data.prices[0][1],
          end: marketChartResponse.data.prices[
            marketChartResponse.data.prices.length - 1
          ][1],
          change_percentage:
            ((marketChartResponse.data.prices[
              marketChartResponse.data.prices.length - 1
            ][1] -
              marketChartResponse.data.prices[0][1]) /
              marketChartResponse.data.prices[0][1]) *
            100,
        },
      },

      // Raw API response (for reference)
      raw_data: marketChartResponse.data,

      metadata: {
        fetch_date: new Date().toISOString(),
        days_requested: days,
        vs_currency: vsCurrency,
        note: 'Free API tier limited to 365 days of historical data',
        upgrade_info:
          'For full historical data (from 2013), upgrade at: https://www.coingecko.com/en/api/pricing',
      },
    };

    return formattedData;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

const saveToFiles = (data, coinId, days, currency) => {
  // Create main data directory
  const outputDir = path.join(__dirname, 'historical_data', coinId);

  // Create subdirectories
  const jsonDir = path.join(outputDir, 'json');
  const csvDir = path.join(outputDir, 'csv');
  const summaryDir = path.join(outputDir, 'summaries');

  [jsonDir, csvDir, summaryDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateStr = new Date().toISOString().split('T')[0];

  // Save complete formatted data as JSON
  const mainFile = path.join(
    jsonDir,
    `${coinId}_${days}days_${currency}_${timestamp}.json`,
  );
  fs.writeFileSync(mainFile, JSON.stringify(data, null, 2));
  console.log(`✅ Complete data saved to: ${mainFile}`);

  // Save just the crypto data (matching ICrypto format)
  const cryptoFile = path.join(
    jsonDir,
    `${coinId}_crypto_format_${dateStr}.json`,
  );
  fs.writeFileSync(cryptoFile, JSON.stringify(data.crypto, null, 2));
  console.log(`✅ Crypto model format saved to: ${cryptoFile}`);

  // Save just the coin history data (matching ICoinHistory format)
  const historyFile = path.join(
    jsonDir,
    `${coinId}_history_format_${dateStr}.json`,
  );
  fs.writeFileSync(historyFile, JSON.stringify(data.coin_history, null, 2));
  console.log(`✅ CoinHistory model format saved to: ${historyFile}`);

  // Save summary
  const summaryFile = path.join(
    summaryDir,
    `${coinId}_${days}days_summary_${dateStr}.json`,
  );
  fs.writeFileSync(summaryFile, JSON.stringify(data.summary, null, 2));
  console.log(`✅ Summary saved to: ${summaryFile}`);

  // Save price history as CSV
  const csvFile = path.join(
    csvDir,
    `${coinId}_${days}days_prices_${dateStr}.csv`,
  );
  const csvContent = ['timestamp,date,price']
    .concat(
      data.coin_history.market_data.prices.map(
        (p) =>
          `${p.timestamp},${new Date(p.timestamp).toISOString()},${p.price}`,
      ),
    )
    .join('\n');
  fs.writeFileSync(csvFile, csvContent);
  console.log(`✅ CSV data saved to: ${csvFile}`);

  // Save simple price history for easy import
  const simpleHistoryFile = path.join(
    csvDir,
    `${coinId}_simple_history_${dateStr}.csv`,
  );
  const simpleContent = ['date,price']
    .concat(
      data.crypto.price_history.map(
        (p) => `${p.date.toISOString().split('T')[0]},${p.price}`,
      ),
    )
    .join('\n');
  fs.writeFileSync(simpleHistoryFile, simpleContent);
  console.log(`✅ Simple history CSV saved to: ${simpleHistoryFile}`);

  // Create a README file with info about the data
  const readmeFile = path.join(outputDir, 'README.md');
  const readmeContent = `# Historical Data for ${data.crypto.name} (${data.crypto.symbol.toUpperCase()})

## Data Summary
- **Coin**: ${data.crypto.name} (${data.crypto.symbol.toUpperCase()})
- **Timeframe**: Last ${days} days
- **Currency**: ${currency.toUpperCase()}
- **Data Points**: ${data.summary.total_data_points}
- **Date Range**: ${data.summary.date_range.from.toISOString().split('T')[0]} to ${data.summary.date_range.to.toISOString().split('T')[0]}
- **Fetch Date**: ${data.metadata.fetch_date}

## Price Statistics
- **Highest Price**: $${data.summary.price_stats.highest.toFixed(2)}
- **Lowest Price**: $${data.summary.price_stats.lowest.toFixed(2)}
- **Average Price**: $${data.summary.price_stats.average.toFixed(2)}
- **Start Price**: $${data.summary.price_stats.start.toFixed(2)}
- **End Price**: $${data.summary.price_stats.end.toFixed(2)}
- **Change**: ${data.summary.price_stats.change_percentage.toFixed(2)}%

## File Structure
- \`/json/\` - JSON files in various formats
  - Complete data with all fields
  - Crypto model format (matches your ICrypto interface)
  - CoinHistory model format (matches your ICoinHistory interface)
- \`/csv/\` - CSV files for easy analysis
  - Full price history with timestamps
  - Simple date-price pairs
- \`/summaries/\` - Summary statistics JSON files

## Data Format Notes
This data matches your Mongoose schemas:
- \`ICrypto\` interface includes price_history array
- \`ICoinHistory\` interface includes market_data with prices array
- All timestamps are preserved in both timestamp and ISO date format

## Limitations
${data.metadata.note}
${data.metadata.upgrade_info}
`;

  fs.writeFileSync(readmeFile, readmeContent);
  console.log(`✅ README saved to: ${readmeFile}`);

  return {
    mainFile,
    cryptoFile,
    historyFile,
    csvFile,
    summaryFile,
    outputDir,
  };
};

// Function to fetch multiple timeframes
const fetchMultipleTimeframes = async (coinId, currency = 'usd') => {
  const timeframes = [7, 14, 30, 90, 180, 365];
  const results = [];

  for (const days of timeframes) {
    try {
      console.log(`\n📊 Fetching ${days} days of data...`);
      const data = await fetchHistoricalData(coinId, days, currency);
      const files = saveToFiles(data, coinId, days, currency);
      results.push({ days, success: true, files });
      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed for ${days} days:`, error.message);
      results.push({ days, success: false, error: error.message });
    }
  }

  // Create a master index file
  const masterIndex = {
    coin: coinId,
    fetch_date: new Date().toISOString(),
    timeframes_fetched: results,
    summary: {
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  };

  const masterFile = path.join(
    __dirname,
    'historical_data',
    coinId,
    'master_index.json',
  );
  fs.writeFileSync(masterFile, JSON.stringify(masterIndex, null, 2));
  console.log(`\n✅ Master index saved to: ${masterFile}`);

  return results;
};

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const coinId = args[0];
  let days = args[1] ? parseInt(args[1]) : 365;
  let currency = args[2] || 'usd';
  const multipleTimeframes = args[3] === 'all';

  if (!coinId) {
    console.error(`
📊 Crypto Historical Data Fetcher
================================

Usage: node history.js <coin-id> [days] [currency] [all]

Examples:
  node history.js bitcoin                    # Fetch last 365 days
  node history.js ethereum 90                # Fetch last 90 days  
  node history.js cardano 30 eur             # Fetch last 30 days in EUR
  node history.js solana 365 usd all         # Fetch all timeframes (7,14,30,90,180,365 days)

Parameters:
  coin-id: CoinGecko coin ID (e.g., bitcoin, ethereum, cardano)
  days: Number of days of history (max 365 for free tier)
  currency: VS currency (usd, eur, gbp, etc.)
  all: Add 'all' as 4th parameter to fetch all timeframes

Output:
  Files will be saved to ./historical_data/<coin-id>/
  - JSON files in model format (matches your Mongoose schemas)
  - CSV files for easy analysis
  - Summary statistics
  - README with data description

Note: Free API tier limited to 365 days of historical data.
    `);
    process.exit(1);
  }

  days = Math.min(days, 365); // Enforce free tier limit

  console.log(`\n🚀 Starting data fetch for ${coinId}...\n`);

  if (multipleTimeframes) {
    console.log(
      `📦 Fetching ALL timeframes for ${coinId} (7, 14, 30, 90, 180, 365 days)`,
    );
    fetchMultipleTimeframes(coinId, currency)
      .then((results) => {
        console.log(
          '\n✨ All done! Check the historical_data folder for your files.',
        );
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌ Failed:', err.message);
        process.exit(1);
      });
  } else {
    fetchHistoricalData(coinId, days, currency)
      .then((data) => {
        saveToFiles(data, coinId, days, currency);
        console.log(
          '\n✨ Done! Check the historical_data folder for your files.',
        );
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌ Failed:', err.message);
        process.exit(1);
      });
  }
}

module.exports = {
  fetchHistoricalData,
  saveToFiles,
  fetchMultipleTimeframes,
};
