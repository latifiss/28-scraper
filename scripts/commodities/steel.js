const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSteel = async () => {
  try {
    const url = 'https://tradingeconomics.com/commodities';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Try HRC Steel (USD/T) first, fall back to Steel (CNY/T) if not found
    const steelRow = $(
      'tr[data-symbol="HRC:COM"], tr[data-symbol="JBP:COM"]'
    ).first();

    if (!steelRow.length) {
      throw new Error('Steel data not found');
    }

    const currentPrice = parseFloat(steelRow.find('td#p').text().trim());
    const percentageChange = parseFloat(
      steelRow.find('td#pch').text().trim().replace('%', '')
    );

    const isHRC = steelRow.attr('data-symbol') === 'HRC:COM';
    const unit = isHRC ? 'USD/T' : 'CNY/T';
    const name = isHRC ? 'HRC Steel' : 'Steel';

    return {
      code: 'steel',
      name: name,
      unit: unit,
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
    console.error('Error scraping Steel:', error.message);
    throw error;
  }
};

module.exports = {
  scrapeSteel,
};

if (require.main === module) {
  scrapeSteel()
    .then((data) => console.log(data))
    .catch((err) => console.error('Error:', err));
}
