const axios = require('axios');
const cheerio = require('cheerio');

const scrapeLithium = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const lithiumRow = $('tr[data-symbol="LC:COM"]');

    if (!lithiumRow.length) {
      throw new Error('Lithium data not found');
    }

    const currentPrice = parseFloat(lithiumRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      lithiumRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'lithium',
      name: 'Lithium',
      unit: 'CNY/T',
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
    console.error('Error scraping Lithium:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeLithium,
};

if (require.main === module) {
  scrapeLithium()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
