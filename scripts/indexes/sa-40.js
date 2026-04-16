const axios = require('axios');
const cheerio = require('cheerio');

const scrapeJSEIndex = async () => {
  try {
    const url = 'https://tradingeconomics.com/top40:ind';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const currentPrice = parseFloat(
      $('#market_last').text().trim().replace(/,/g, ''),
    );
    const dailyChangeText = $('#market_daily_chg').text().trim();
    const dailyPercentageText = $('#market_daily_Pchg')
      .text()
      .trim()
      .replace('%', '');

    const monthlyText = $(
      '.market-header-value:contains("Monthly") span:not([id])',
    )
      .text()
      .trim()
      .replace('%', '');
    const yearlyText = $(
      '.market-header-value:contains("Yearly") span:not([id])',
    )
      .text()
      .trim()
      .replace('%', '');

    if (!currentPrice) {
      throw new Error('Could not find the SA40 data');
    }

    const valueChange = parseFloat(dailyChangeText.replace(/,/g, ''));
    const dailyPercentageChange = parseFloat(dailyPercentageText);
    const monthlyChange = parseFloat(monthlyText);
    const yearlyChange = parseFloat(yearlyText);

    const stockData = {
      code: 'SA40',
      symbol: 'TOP40:IND',
      name: 'South Africa Stock Market Index (SA40)',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: null,
      monthly_change: monthlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status: 'Market open',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'South Africa Stock Market Index (SA40) tracking top 40 companies by market capitalization',
        components: 40,
        sector_breakdown: {
          financials: 0,
          consumer_goods: 0,
          industrials: 0,
          resources: 0,
          others: 100,
        },
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping SA40 Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeJSEIndex,
};

if (require.main === module) {
  scrapeJSEIndex()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
