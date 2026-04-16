const axios = require('axios');
const cheerio = require('cheerio');

const scrapeAUDGHS = async () => {
  try {
    const url = 'https://tradingeconomics.com/audghs:cur';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const currentPrice = parseFloat($('#market_last').text().trim());
    const dailyPercentageChange = parseFloat(
      $('.te-market-changes-spacing #market_daily_Pchg')
        .text()
        .trim()
        .replace('%', '')
    );
    const monthlyChangeText = $('.market-header-value:nth-child(3) span:last')
      .text()
      .trim()
      .replace('%', '');
    const yearlyChangeText = $('.market-header-value:nth-child(4) span:last')
      .text()
      .trim()
      .replace('%', '');

    return {
      code: 'audghs',
      name: 'AUD/GHS',
      from_currency: 'Australian Dollar',
      from_code: 'AUD',
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
    throw error;
  }
};

module.exports = {
  scrapeAUDGHS,
};

if (require.main === module) {
  scrapeAUDGHS()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
