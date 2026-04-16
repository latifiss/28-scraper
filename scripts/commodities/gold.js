const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGold = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const goldRow = $('tr[data-symbol="XAUUSD:CUR"]');

    if (!goldRow.length) {
      throw new Error('Gold data not found');
    }

    const currentPrice = parseFloat(goldRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      goldRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'gold',
      name: 'Gold',
      unit: 'USD/t oz',
      category: 'metal',
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
  } catch (error) {
    console.error('Error scraping Gold:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeGold,
};

if (require.main === module) {
  scrapeGold()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
