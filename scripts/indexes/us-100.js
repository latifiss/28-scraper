const axios = require('axios');
const cheerio = require('cheerio');

const scrapeNASDAQ100 = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="US100:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the NASDAQ 100 data row');
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
      code: 'US100',
      symbol: 'US100',
      name: 'NASDAQ 100 Index',
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
          'Modified market-capitalization weighted index tracking 100 of the largest non-financial companies listed on NASDAQ',
        base_value: 125,
        base_date: 'January 31, 1985',
        sector_breakdown: {
          technology: 58.3,
          consumer_services: 19.7,
          healthcare: 7.5,
          industrials: 6.2,
          telecommunications: 4.8,
          others: 3.5,
        },
        top_components: ['Apple', 'Microsoft', 'Amazon', 'Nvidia', 'Tesla'],
        trading_hours: '09:30-16:00 ET',
        currency: 'USD',
        source: 'Trading Economics',
        index_characteristics: {
          is_modified_market_cap_weighted: true,
          excludes_financial_companies: true,
          heavy_tech_concentration: true,
        },
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping NASDAQ 100 data:', error);
    throw error;
  }
};

module.exports = {
  scrapeNASDAQ100,
};

if (require.main === module) {
  scrapeNASDAQ100()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
