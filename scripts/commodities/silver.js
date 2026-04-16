const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSilver = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const silverRow = $('tr[data-symbol="XAGUSD:CUR"]');

    if (!silverRow.length) {
      throw new Error('Silver data not found');
    }

    const currentPrice = parseFloat(silverRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      silverRow.find('td#pch').text().trim().replace('%', '')
    );

    return {
      code: 'silver',
      name: 'Silver',
      unit: 'USD/t oz',
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
    console.error('Error scraping Silver:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeSilver,
};

if (require.main === module) {
  scrapeSilver()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
