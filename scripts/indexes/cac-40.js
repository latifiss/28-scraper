const axios = require('axios');
const cheerio = require('cheerio');

const scrapeCAC40 = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="CAC:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the CAC 40 data row');
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
      code: 'CAC',
      symbol: 'FR40',
      name: 'CAC 40 Index',
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
          'Benchmark French stock market index tracking 40 largest companies listed on Euronext Paris',
        base_value: 1000,
        base_date: 'December 31, 1987',
        sector_breakdown: {
          luxury_goods: 22.5,
          financials: 18.7,
          industrials: 15.3,
          consumer_goods: 12.4,
          technology: 10.2,
          others: 20.9,
        },
        top_components: [
          'LVMH',
          "L'Oréal",
          'TotalEnergies',
          'Sanofi',
          'Hermès',
        ],
        trading_hours: '09:00-17:30 CET',
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping CAC 40 Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeCAC40,
};

if (require.main === module) {
  scrapeCAC40()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
