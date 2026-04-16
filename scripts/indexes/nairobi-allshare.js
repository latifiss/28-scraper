const axios = require('axios');
const cheerio = require('cheerio');

const scrapeNSEASI = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="NSEASI:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the NSEASI data row');
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
      code: 'NSEASI',
      symbol: 'NSEASI',
      name: 'Nairobi Securities Exchange All Share Index',
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
          'Market capitalization-weighted index tracking all listed companies on the Nairobi Securities Exchange',
        base_value: 100,
        base_date: 'January 2008',
        sector_breakdown: {
          financials: 38.2,
          industrials: 22.5,
          consumer_goods: 18.7,
          services: 12.4,
          others: 8.2,
        },
        top_components: [
          'Safaricom',
          'Equity Group',
          'KCB Group',
          'Co-operative Bank',
          'East African Breweries',
        ],
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping NSE All Share Index data:', error);
    throw error;
  }
};

module.exports = {
  scrapeNSEASI,
};

if (require.main === module) {
  scrapeNSEASI()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
