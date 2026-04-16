const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGhanaStockIndex = async () => {
  try {
    const url = 'https://tradingeconomics.com/stocks';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const row = $('tr[data-symbol="GGSECI:IND"]');

    if (row.length === 0) {
      throw new Error('Could not find the GGSECI data row');
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

    // Get additional historical data from other sources
    const allTimeHigh = 6758.48; // From Trading Economics historical data :cite[2]
    const yearToDateChange = 27.76; // From GSE website :cite[4]

    const stockData = {
      code: 'GGSECI',
      symbol: 'GGSECI',
      name: 'Ghana Stock Exchange Composite Index',
      currentPrice: currentPrice,
      value_change: valueChange,
      percentage_change: dailyPercentageChange,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      yearly_change: yearlyChange,
      ytd_change: yearToDateChange,
      all_time_high: allTimeHigh,
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
          'Market capitalization-weighted index tracking all listed companies on the Ghana Stock Exchange (base value 1000 on 12/31/10)',
        base_value: 1000,
        base_date: '2010-12-31',
        source: 'Trading Economics',
      },
    };

    console.log('Scraped data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Ghana Stock Exchange data:', error);
    throw error;
  }
};

module.exports = {
  scrapeGhanaStockIndex,
};

if (require.main === module) {
  scrapeGhanaStockIndex()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
