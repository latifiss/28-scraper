const axios = require('axios');
const cheerio = require('cheerio');

const scrapeFTSE100 = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="UKX:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the FTSE 100 data row');
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
      code: 'UKX',
      symbol: 'GB100',
      name: 'FTSE 100 Index',
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
          'Capitalization-weighted index of 100 most highly capitalized companies on the London Stock Exchange',
        base_value: 1000,
        base_date: 'January 3, 1984',
        sector_breakdown: {
          financials: 22.1,
          consumer_goods: 18.7,
          energy: 12.4,
          healthcare: 11.8,
          industrials: 10.5,
          others: 24.5,
        },
        top_components: ['HSBC', 'AstraZeneca', 'Shell', 'Unilever', 'BP'],
        trading_hours: '08:00-16:30 GMT',
        currency: 'GBP',
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping FTSE 100 Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeFTSE100,
};

if (require.main === module) {
  scrapeFTSE100()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
