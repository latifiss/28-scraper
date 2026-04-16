const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSugar = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const sugarRow = $('tr[data-symbol="SB1:COM"]');

    if (!sugarRow.length) {
      throw new Error('Sugar data not found');
    }

    const currentPrice = parseFloat(sugarRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      sugarRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'sugar',
      name: 'Sugar',
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
    console.error('Error scraping Sugar:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeSugar,
};

if (require.main === module) {
  scrapeSugar()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
