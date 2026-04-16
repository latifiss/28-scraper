const axios = require('axios');
const cheerio = require('cheerio');

const scrapeSensex = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="SENSEX:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the SENSEX data row');
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
      code: 'SENSEX',
      symbol: 'SENSEX',
      name: 'S&P BSE SENSEX',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      quarterly_change: quarterlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status: row.find('td#session span').attr('title') || 'Market open',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'Free-float market-weighted stock market index of 30 well-established and financially sound companies listed on Bombay Stock Exchange',
        base_value: 100,
        base_date: 'April 1979',
        sector_breakdown: {
          financials: 37.2,
          information_technology: 13.8,
          energy: 12.5,
          consumer_goods: 11.3,
          healthcare: 9.7,
          others: 15.5,
        },
        top_components: [
          'Reliance Industries',
          'HDFC Bank',
          'ICICI Bank',
          'Infosys',
          'Hindustan Unilever',
        ],
        trading_hours: '09:15-15:30 IST',
        currency: 'INR',
        source: 'Trading Economics',
        key_characteristics: {
          is_free_float_adjusted: true,
          is_market_cap_weighted: true,
          represents_blue_chips: true,
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping SENSEX data:', error);
    throw error;
  }
};

module.exports = {
  scrapeSensex,
};

if (require.main === module) {
  scrapeSensex()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
