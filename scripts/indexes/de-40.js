const axios = require('axios');
const cheerio = require('cheerio');

const scrapeDAX = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the table row with the DAX Index data
    const row = $('tr[data-symbol="DAX:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the DAX data row');
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
      code: 'DAX',
      symbol: 'DE40',
      name: 'DAX Performance Index',
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
          'Blue-chip stock market index tracking 40 major German companies trading on the Frankfurt Stock Exchange',
        base_value: 1000,
        base_date: 'December 30, 1987',
        sector_breakdown: {
          industrials: 28.5,
          technology: 18.7,
          consumer_goods: 15.3,
          healthcare: 12.4,
          financials: 10.2,
          others: 14.9,
        },
        top_components: ['SAP', 'Siemens', 'Allianz', 'Volkswagen', 'BASF'],
        trading_hours: '09:00-17:30 CET',
        currency: 'EUR',
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping DAX Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeDAX,
};

if (require.main === module) {
  scrapeDAX()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
