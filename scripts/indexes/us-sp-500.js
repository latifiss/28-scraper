const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSP500 = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="SPX:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the S&P 500 data row');
    }

    const currentPrice = parseFloat(row.find('td:nth-child(3)').text().trim());
    const valueChange = parseFloat(row.find('td:nth-child(4)').text().trim());
    const dailyPercentageChange = parseFloat(
      row.find('td:nth-child(5)').text().trim().replace('%', ''),
    );
    const weeklyChange = parseFloat(
      row.find('td:nth-child(6)').text().trim().replace('%', ''),
    );
    const monthlyChange = parseFloat(
      row.find('td:nth-child(7)').text().trim().replace('%', ''),
    );
    const quarterlyChange = parseFloat(
      row.find('td:nth-child(8)').text().trim().replace('%', ''),
    );
    const yearlyChange = parseFloat(
      row.find('td:nth-child(9)').text().trim().replace('%', ''),
    );

    const stockData = {
      code: 'SPX',
      symbol: 'US500',
      name: 'S&P 500 Index',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      quarterly_change: quarterlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status: row.find('td#session span').attr('title') || 'Pre-market',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'Market-capitalization-weighted index of 500 leading US publicly traded companies',
        base_value: 10,
        base_date: '1941-1943',
        sector_breakdown: {
          information_technology: 28.7,
          healthcare: 13.4,
          financials: 12.8,
          consumer_discretionary: 10.5,
          communication_services: 8.9,
          others: 25.7,
        },
        top_components: ['Microsoft', 'Apple', 'Nvidia', 'Amazon', 'Meta'],
        trading_hours: '09:30-16:00 ET',
        currency: 'USD',
        source: 'Trading Economics',
        index_characteristics: {
          is_market_cap_weighted: true,
          represents_80pct_us_market_cap: true,
          includes_multiple_share_classes: false,
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping S&P 500 data:', error);
    throw error;
  }
};

module.exports = {
  scrapeSP500,
};

if (require.main === module) {
  scrapeSP500()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
