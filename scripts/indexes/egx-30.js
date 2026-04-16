const axios = require('axios');
const cheerio = require('cheerio');

const scrapeEgyptStockMarket = async () => {
  try {
    const url = 'https://tradingeconomics.com/egypt/stock-market';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="CASE:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the Egypt stock market data row');
    }

    const currentPrice = parseFloat(
      row.find('td[id="p"]').text().trim().replace(/,/g, ''),
    );
    const valueChange = parseFloat(
      row.find('td[id="nch"]').text().trim().replace(/,/g, ''),
    );
    const dailyPercentageChange = parseFloat(
      row.find('td[id="pch"]').text().trim().replace('%', ''),
    );
    const monthlyChange = parseFloat(
      row.find('td:nth-child(6)').text().trim().replace('%', ''),
    );
    const yearlyChange = parseFloat(
      row.find('td:nth-child(7)').text().trim().replace('%', ''),
    );

    const stockData = {
      code: 'EGX30',
      symbol: 'CASE:IND',
      name: 'Egypt Stock Market (EGX30)',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: null,
      monthly_change: monthlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      market_status: 'Market open',
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'The EGX 30 Index is a major stock market index which tracks the performance of the 30 most liquid stocks traded on the Egyptian Exchange',
        components: 30,
        source: 'Trading Economics',
      },
    };

    console.log('Scraped Egypt stock market data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Egypt Stock Market (EGX30) data:', error);
    throw error;
  }
};

module.exports = {
  scrapeEgyptStockMarket,
};

if (require.main === module) {
  scrapeEgyptStockMarket()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => console.error(err));
}
