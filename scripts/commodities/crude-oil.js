const axios = require('axios');
const cheerio = require('cheerio');

const scrapeCrudeOil = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the Crude Oil row (WTI)
    const crudeRow = $('tr[data-symbol="CL1:COM"]');

    if (!crudeRow.length) {
      throw new Error('Crude Oil data not found');
    }

    const currentPrice = parseFloat(crudeRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      crudeRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'crudeoil',
      name: 'Crude Oil',
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
  } catch (error) {
    console.error('Error scraping Crude Oil:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeCrudeOil,
};

if (require.main === module) {
  scrapeCrudeOil()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
