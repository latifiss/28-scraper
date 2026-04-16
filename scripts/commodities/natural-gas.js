const axios = require('axios');
const cheerio = require('cheerio');

const scrapeNaturalGas = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the Natural Gas row
    const ngRow = $('tr[data-symbol="NG1:COM"]');

    if (!ngRow.length) {
      throw new Error('Natural Gas data not found');
    }

    const currentPrice = parseFloat(ngRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      ngRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'naturalgas',
      name: 'Natural Gas',
      unit: 'USD/MMBtu',
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
  } catch (error) {
    console.error('Error scraping Natural Gas:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeNaturalGas,
};

if (require.main === module) {
  scrapeNaturalGas()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
