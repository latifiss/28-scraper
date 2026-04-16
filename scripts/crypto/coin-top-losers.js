const axios = require('axios');
require('dotenv').config();

const fetchTopLosers = async (topN = 10, vsCurrency = 'usd') => {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: vsCurrency,
          order: 'market_cap_desc',
          per_page: 400,
          sparkline: false,
          price_change_percentage: '24h',
        },
        headers: {
          accept: 'application/json',
          'x-cg-demo-api-key': process.env.COINGECKO_KEY,
        },
      }
    );

    const sortedLosers = response.data.sort(
      (a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h
    );

    const topLosers = sortedLosers.slice(0, topN).map((coin, index) => ({
      rank: index + 1,
      ...coin,
      symbol: coin.symbol.toUpperCase(),
    }));

    return topLosers;
  } catch (error) {
    console.error('Error fetching top losers:', error.message);
    throw error;
  }
};

module.exports = fetchTopLosers;

if (require.main === module) {
  const topN = parseInt(process.argv[2]) || 10;
  const currency = process.argv[3] || 'usd';
  fetchTopLosers(topN, currency)
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch(console.error);
}
