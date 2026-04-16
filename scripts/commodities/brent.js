const axios = require('axios');
const cheerio = require('cheerio');

const scrapeBrentCrude = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the Brent Crude row
    const brentRow = $('tr[data-symbol="CO1:COM"]');

    if (!brentRow.length) {
      throw new Error('Brent Crude data not found');
    }

    const currentPrice = parseFloat(brentRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      brentRow.find('td#pch').text().trim().replace('%', '')
    );

    const commodityData = {
      code: 'brent',
      name: 'Brent Crude',
      unit: 'USD/Bbl',
      category: 'energy',
      currentPrice: currentPrice,
      percentage_change: percentageChange,
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
        },
      ],
      last_updated: new Date(),
    };

    return commodityData;
  } catch (error) {
    console.error('Error scraping Brent Crude:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeBrentCrude,
};

if (require.main === module) {
  scrapeBrentCrude()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
