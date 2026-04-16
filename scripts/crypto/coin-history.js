const axios = require('axios');
require('dotenv').config();

const fetchCoinHistory = async (coinId, date) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/history`,
      {
        params: {
          date: date,
        },
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
      }
    );
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching coin history:', error.message);
    throw error;
  }
};

const coinId = process.argv[2];
const date = process.argv[3];

if (!coinId || !date) {
  console.error('Please provide both coin ID and date as arguments');
  console.log(
    'Usage: node scripts/crypto/coin-history.js <coin-id> <dd-mm-yyyy>'
  );
  console.log(
    'Example: node scripts/crypto/coin-history.js bitcoin 30-12-2022'
  );
  process.exit(1);
}

fetchCoinHistory(coinId, date);
