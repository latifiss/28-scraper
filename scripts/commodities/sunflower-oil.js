const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSunflowerOil = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const sunflowerOilRow = $('tr[data-symbol="SUNF:COM"]');

    if (!sunflowerOilRow.length) {
      throw new Error('Sunflower Oil data not found');
    }

    const currentPrice = parseFloat(sunflowerOilRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      sunflowerOilRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'sunfloweroil',
      name: 'Sunflower Oil',
      unit: 'USD/T',
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
    console.error('Error scraping Sunflower Oil:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeSunflowerOil,
};

if (require.main === module) {
  scrapeSunflowerOil()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
