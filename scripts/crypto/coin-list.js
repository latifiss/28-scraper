const axios = require('axios');
require('dotenv').config();

const fetchCoinMarketData = async () => {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: { vs_currency: 'usd' },
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching coin market data:', error.message);
    throw error;
  }
};

module.exports = fetchCoinMarketData;
