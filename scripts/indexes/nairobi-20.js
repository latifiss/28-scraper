const axios = require('axios');
const cheerio = require('cheerio');

const scrapeKenyaStockMarket = async () => {
  try {
    const url = 'https://tradingeconomics.com/kenya/stock-market';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Using the same selector pattern as the Egypt scraper, targeting the table row
    // We need to find the correct symbol for Kenya. Based on common patterns, it might be "NSE20:IND" or similar.
    // Let's search for a row containing the key text "Nairobi 20" or use a more flexible approach.
    // A robust way: find the row where the link's href includes "/kenya/stock-market"
    const row = $('tr')
      .filter((i, el) => {
        return $(el).find('a[href="/kenya/stock-market"]').length > 0;
      })
      .first();

    if (row.length === 0) {
      // Fallback: try to find by symbol if known, but it's better to rely on the href as above.
      // For this example, we'll proceed assuming the row is found. If not, throw error.
      throw new Error(
        'Could not find the Kenya stock market data row using link selector.',
      );
    }

    // Extract data using similar child indices as the Egypt example
    // Indices: 0 - Index Name, 1 - Price, 3 - Value Change, 4 - Day%, 5 - Month%, 6 - Year%
    const currentPrice = parseFloat(
      row.find('td').eq(1).text().trim().replace(/,/g, ''),
    );
    const valueChange = parseFloat(
      row.find('td').eq(3).text().trim().replace(/,/g, ''),
    );
    const dailyPercentageChange = parseFloat(
      row.find('td').eq(4).text().trim().replace('%', ''),
    );
    const monthlyChange = parseFloat(
      row.find('td').eq(5).text().trim().replace('%', ''),
    );
    const yearlyChange = parseFloat(
      row.find('td').eq(6).text().trim().replace('%', ''),
    );

    // Get symbol from the row's data-symbol attribute if needed
    const symbol = row.attr('data-symbol') || 'NSE20:IND';

    const stockData = {
      code: 'NSE20',
      symbol: symbol,
      name: 'Kenya Stock Market (NSE20)',
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
          'The Nairobi Securities Exchange 20 Share Index (NSE20) tracks the performance of 20 best-performing companies listed on the Nairobi Securities Exchange.',
        components: 20,
        source: 'Trading Economics',
      },
    };

    console.log('Scraped Kenya stock market data:', stockData);
    return stockData;
  } catch (error) {
    console.error('Error scraping Kenya Stock Market (NSE20) data:', error);
    throw error;
  }
};

module.exports = {
  scrapeKenyaStockMarket,
};

if (require.main === module) {
  scrapeKenyaStockMarket()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => console.error(err));
}
