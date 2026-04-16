const axios = require('axios');
const cheerio = require('cheerio');

const scrapeCoffee = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const coffeeRow = $('tr[data-symbol="KC1:COM"]');

    if (!coffeeRow.length) {
      throw new Error('Coffee data not found');
    }

    const currentPrice = parseFloat(coffeeRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      coffeeRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'coffee',
      name: 'Coffee',
      unit: 'USd/Lbs',
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
    console.error('Error scraping Coffee:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeCoffee,
};

if (require.main === module) {
  scrapeCoffee()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
