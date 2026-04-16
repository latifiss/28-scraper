const axios = require('axios');

const fetchTether = async () => {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/tether'
    );

    const data = response.data;

    const formattedData = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      image: data.image.large,
      current_price: data.market_data.current_price.usd,
      market_cap: data.market_data.market_cap.usd,
      market_cap_rank: data.market_cap_rank,
      fully_diluted_valuation: data.market_data.fully_diluted_valuation.usd,
      total_volume: data.market_data.total_volume.usd,
      high_24h: data.market_data.high_24h.usd,
      low_24h: data.market_data.low_24h.usd,
      price_change_24h: data.market_data.price_change_24h,
      price_change_percentage_24h: data.market_data.price_change_percentage_24h,
      market_cap_change_24h: data.market_data.market_cap_change_24h,
      market_cap_change_percentage_24h:
        data.market_data.market_cap_change_percentage_24h,
      price_history: [],
      last_updated: new Date(data.last_updated),
    };

    console.log('[TETHER] Structured data:', formattedData);
    return formattedData;
  } catch (error) {
    console.error('[TETHER] Error fetching coin data:', error.message);
    throw error;
  }
};

module.exports = { fetchTether };
