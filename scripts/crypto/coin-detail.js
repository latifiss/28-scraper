const axios = require('axios');
require('dotenv').config();

const fetchCoinData = async (coinId) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}`,
      {
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching coin data:', error.message);
    throw error;
  }
};

module.exports = fetchCoinData;

if (require.main === module) {
  const coinId = process.argv[2];
  if (!coinId) {
    console.error('Please provide a coin ID as an argument');
    console.log('Usage: node scripts/crypto/coin-detail <coin-id>');
    console.log('Example: node scripts/crypto/coin-detail bitcoin');
    process.exit(1);
  }

  fetchCoinData(coinId)
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => process.exit(1));
}
