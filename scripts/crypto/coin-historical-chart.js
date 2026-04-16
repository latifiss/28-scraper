const axios = require('axios');
require('dotenv').config();

const fetchMarketChart = async (coinId, days = '30', vsCurrency = 'usd') => {
  try {
    if (isNaN(days) && days !== 'max') {
      throw new Error('Days parameter must be a number or "max"');
    }

    const coinDetails = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}`,
      {
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
        timeout: 10000,
      }
    );

    const marketChartResponse = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
      {
        params: {
          vs_currency: vsCurrency,
          days: days,
          interval: days > 90 ? 'daily' : undefined,
        },
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
        timeout: 10000,
      }
    );

    return {
      id: coinDetails.data.id,
      symbol: coinDetails.data.symbol,
      name: coinDetails.data.name,
      market_data: marketChartResponse.data,
    };
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = fetchMarketChart;

if (require.main === module) {
  const args = process.argv.slice(2);
  const coinId = args[0];
  let days = '30';
  let currency = 'usd';

  args.forEach((arg) => {
    if (!isNaN(arg)) days = arg;
    else if (arg.length === 3) currency = arg.toLowerCase();
  });

  if (!coinId) {
    console.error(
      'Usage: node coin-historical-chart.js <coin-id> [days] [currency]'
    );
    process.exit(1);
  }

  fetchMarketChart(coinId, days, currency)
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => process.exit(1));
}
