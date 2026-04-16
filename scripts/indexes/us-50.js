const axios = require('axios');
const cheerio = require('cheerio');

const scrapeDJIA = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="INDU:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the DJIA data row');
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
      code: 'INDU',
      symbol: 'US30',
      name: 'Dow Jones Industrial Average',
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
          'Price-weighted index tracking 30 large, publicly-owned blue-chip companies trading on US exchanges',
        base_value: 40.94,
        base_date: 'May 26, 1896',
        sector_breakdown: {
          industrials: 23.5,
          healthcare: 18.2,
          financials: 16.3,
          technology: 15.8,
          consumer_goods: 12.4,
          others: 13.8,
        },
        top_components: [
          'UnitedHealth',
          'Goldman Sachs',
          'Home Depot',
          'Microsoft',
          'Boeing',
        ],
        trading_hours: '09:30-16:00 ET',
        currency: 'USD',
        source: 'Trading Economics',
        index_characteristics: {
          is_price_weighted: true,
          represents_industrial_sector: true,
          components_selected_by_editors: true,
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping DJIA data:', error);
    throw error;
  }
};

module.exports = {
  scrapeDJIA,
};

if (require.main === module) {
  scrapeDJIA()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
