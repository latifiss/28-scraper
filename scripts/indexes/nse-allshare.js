const axios = require('axios');
const cheerio = require('cheerio');

const scrapeNigerianStockIndex = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="NGSEINDX:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the NGSEINDX data row');
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
    const yearlyChange = parseFloat(
      row.find('td:nth-child(8)').text().trim().replace('%', '')
    );

    const stockData = {
      code: 'NGSEINDX',
      symbol: 'NGSEINDX',
      name: 'Nigerian Stock Exchange All Share Index',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      yearly_change: yearlyChange,
      last_updated: new Date(),
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          daily_change: dailyPercentageChange,
        },
      ],
      metadata: {
        description:
          'Market capitalization-weighted index tracking all listed companies on the Nigerian Stock Exchange',
        source: 'Trading Economics',
        trading_status:
          row.find('td#session span').attr('title') || 'Market open',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Nigerian Stock Exchange data:', error);
    throw error;
  }
};

module.exports = {
  scrapeNigerianStockIndex,
};

if (require.main === module) {
  scrapeNigerianStockIndex()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
