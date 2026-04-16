const axios = require('axios');
const cheerio = require('cheerio');

const scrapeCopper = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const copperRow = $(
      'tr[data-symbol="COPPERUSD:CUR"], tr[data-symbol="HG1:COM"]'
    ).first();

    if (!copperRow.length) {
      throw new Error('Copper data not found');
    }

    const currentPrice = parseFloat(copperRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      copperRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'copper',
      name: 'Copper',
      unit: 'USD/lbs',
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
    console.error('Error scraping Copper:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeCopper,
};

if (require.main === module) {
  scrapeCopper()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
