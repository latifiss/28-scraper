const axios = require('axios');
const cheerio = require('cheerio');

const scrapeRubber = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const rubberRow = $('tr[data-symbol="JN1:COM"]');

    if (!rubberRow.length) {
      throw new Error('Rubber data not found');
    }

    const currentPrice = parseFloat(rubberRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      rubberRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'rubber',
      name: 'Rubber',
      unit: 'USD Cents / Kg',
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
    console.error('Error scraping Rubber:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeRubber,
};

if (require.main === module) {
  scrapeRubber()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
