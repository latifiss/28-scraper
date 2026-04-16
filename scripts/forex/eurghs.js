const axios = require('axios');
const cheerio = require('cheerio');

const scrapeEURGHS = async () => {
  try {
    const url = 'https://tradingeconomics.com/eurghs:cur';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const currentPrice = parseFloat($('#market_last').text().trim());

    const dailyPctChangeElement = $(
      '.te-market-changes-spacing #market_daily_Pchg'
    );
    const dailyPercentageChangeText = dailyPctChangeElement
      .text()
      .trim()
      .replace('%', '');
    const dailyPercentageChange = parseFloat(dailyPercentageChangeText);

    const monthlyChangeText = $('.market-header-value:nth-child(3) span:last')
      .text()
      .trim()
      .replace('%', '');
    const yearlyChangeText = $('.market-header-value:nth-child(4) span:last')
      .text()
      .trim()
      .replace('%', '');

    return {
      code: 'eurghs',
      name: 'EUR/GHS',
      from_currency: 'Euro',
      from_code: 'EUR',
      to_currency: 'Ghanaian Cedi',
      to_code: 'GHS',
      currentPrice: currentPrice,
      percentage_change: dailyPercentageChange,
      monthly_change: parseFloat(monthlyChangeText),
      yearly_change: parseFloat(yearlyChangeText),
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          percentage_change: dailyPercentageChange,
        },
      ],
      last_updated: new Date(),
    };
  } catch (error) {
    console.error('Error scraping EUR/GHS data:', error);
    throw error;
  }
};

module.exports = {
  scrapeEURGHS,
};

if (require.main === module) {
  scrapeEURGHS()
    .then((data) => console.log('Scraped data:', data))
    .catch((err) => console.error('Error:', err));
}
