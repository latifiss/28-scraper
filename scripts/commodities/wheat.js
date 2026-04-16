const axios = require('axios');
const cheerio = require('cheerio');

const scrapeWheat = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const wheatRow = $('tr[data-symbol="W 1:COM"]');

    if (!wheatRow.length) {
      throw new Error('Wheat data not found');
    }

    const currentPrice = parseFloat(wheatRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      wheatRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'wheat',
      name: 'Wheat',
      unit: 'USd/Bu',
      category: 'agricultural',
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
    console.error('Error scraping Wheat:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeWheat,
};

if (require.main === module) {
  scrapeWheat()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
