const axios = require('axios');
const cheerio = require('cheerio');

const scrapeCocoa = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const cocoaRow = $('tr[data-symbol="CC1:COM"]');

    if (!cocoaRow.length) {
      throw new Error('Cocoa data not found');
    }

    const currentPrice = parseFloat(cocoaRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      cocoaRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'cocoa',
      name: 'Cocoa',
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
    console.error('Error scraping Cocoa:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeCocoa,
};

if (require.main === module) {
  scrapeCocoa()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
