const axios = require('axios');
const cheerio = require('cheerio');

const scrapeNikkei225 = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="NKY:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the Nikkei 225 data row');
    }

    const currentPrice = parseFloat(row.find('td:nth-child(3)').text().trim());
    const valueChange = parseFloat(row.find('td:nth-child(4)').text().trim());
    const dailyPercentageChange = parseFloat(
      row.find('td:nth-child(5)').text().trim().replace('%', '')
    );
    const weeklyChange = parseFloat(
      row.find('td:nth-child(6)').text().trim().replace('%', '')
    );
    const monthlyChange = parseFloat(
      row.find('td:nth-child(7)').text().trim().replace('%', '')
    );
    const quarterlyChange = parseFloat(
      row.find('td:nth-child(8)').text().trim().replace('%', '')
    );
    const yearlyChange = parseFloat(
      row.find('td:nth-child(9)').text().trim().replace('%', '')
    );

    const stockData = {
      code: 'NKY',
      symbol: 'JP225',
      name: 'Nikkei 225 Stock Average',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      quarterly_change: quarterlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status: row.find('td#session span').attr('title') || 'After hours',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'Price-weighted stock market index tracking 225 large, publicly-owned companies in Japan',
        base_value: 176.21, // Adjusted for historical splits
        base_date: 'May 16, 1949',
        sector_breakdown: {
          technology: 28.5,
          consumer_goods: 19.7,
          industrials: 18.3,
          financials: 12.4,
          materials: 8.2,
          others: 12.9,
        },
        top_components: [
          'Fast Retailing',
          'Tokyo Electron',
          'SoftBank Group',
          'Advantest',
          'Sony Group',
        ],
        trading_hours: '09:00-15:00 JST (with lunch break)',
        currency: 'JPY',
        source: 'Trading Economics',
        index_characteristics: {
          is_price_weighted: true,
          includes_dividend_adjusted_companies: false,
          yen_denominated: true,
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Nikkei 225 data:', error);
    throw error;
  }
};

module.exports = {
  scrapeNikkei225,
};

if (require.main === module) {
  scrapeNikkei225()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
