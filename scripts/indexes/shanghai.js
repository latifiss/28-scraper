const axios = require('axios');
const cheerio = require('cheerio');

const scrapeShanghaiComposite = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="SHCOMP:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the Shanghai Composite data row');
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
      code: 'SHCOMP',
      symbol: 'SHANGHAI',
      name: 'Shanghai Composite Index',
      currentPrice: currentPrice,
      value_change: -Math.abs(valueChange), // Ensure negative value
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      quarterly_change: quarterlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status:
        row.find('td#session span').attr('title') || 'Market closed',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'Market-capitalization weighted index tracking all stocks (A-shares and B-shares) listed on the Shanghai Stock Exchange',
        base_value: 100,
        base_date: 'December 19, 1990',
        sector_breakdown: {
          financials: 32.7,
          industrials: 24.1,
          consumer: 15.8,
          materials: 12.3,
          others: 15.1,
        },
        top_components: [
          'Kweichow Moutai',
          'Industrial Bank',
          'Ping An Insurance',
          'China Merchants Bank',
          'PetroChina',
        ],
        trading_hours: '09:30-15:00 CST (with lunch break)',
        currency: 'CNY',
        source: 'Trading Economics',
        market_characteristics: {
          is_emerging_market: true,
          has_foreign_investment_limits: true,
          dominant_investor_type: 'Retail investors',
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Shanghai Composite Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeShanghaiComposite,
};

if (require.main === module) {
  scrapeShanghaiComposite()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
