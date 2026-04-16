const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGasoline = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the Gasoline row (using XB1:COM symbol)
    const gasolineRow = $('tr[data-symbol="XB1:COM"]');

    if (!gasolineRow.length) {
      throw new Error('Gasoline data not found');
    }

    const currentPrice = parseFloat(gasolineRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      gasolineRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'gasoline',
      name: 'Gasoline',
      unit: 'USD/Gal',
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
    console.error('Error scraping Gasoline:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeGasoline,
};

if (require.main === module) {
  scrapeGasoline()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
