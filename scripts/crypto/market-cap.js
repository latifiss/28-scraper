const axios = require('axios');

async function getMarketCapData() {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1'
    );

    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error('Error fetching market cap data:', error.message);
    throw error;
  }
}

getMarketCapData();
