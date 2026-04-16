const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGSEStockData = async (symbol = 'aads') => {
  try {
    const url = `https://afx.kwayisi.org/gse/${symbol}.html`;
    console.log(`Fetching data from: ${url}`);

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    let valuationData = {};

    const valuationTable = $('table')
      .filter((i, table) => {
        return $(table).find('th').text().includes('Growth & Valuation');
      })
      .first();

    if (valuationTable.length === 0) {
      console.log('Could not find "Growth & Valuation" table');
      return null;
    }

    console.log('Found "Growth & Valuation" table');

    valuationTable.find('tbody tr').each((index, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const metric = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        valuationData[metric] = value;
      }
    });

    const companyName = $('h1').first().text().trim();
    const stockPrice = $('div#price, span.price, .price').first().text().trim();

    const result = {
      symbol: symbol.toUpperCase(),
      company: companyName || 'Unknown',
      stockPrice: stockPrice || 'N/A',
      valuation: valuationData,
    };

    return result;
  } catch (error) {
    console.error(`Error scraping ${symbol}:`, error.message);

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`URL: ${error.response.config.url}`);
    }

    throw error;
  }
};

const testScraper = async () => {
  try {
    console.log('Testing GSE stock data scraper...\n');

    const data = await scrapeGSEStockData('aads');

    if (data) {
      console.log('\n=== SCRAPING SUCCESSFUL ===');
      console.log(`Company: ${data.company}`);
      console.log(`Symbol: ${data.symbol}`);
      console.log(`Stock Price: ${data.stockPrice}`);
      console.log('\n--- Growth & Valuation Data ---');

      for (const [metric, value] of Object.entries(data.valuation)) {
        console.log(`${metric}: ${value}`);
      }

      console.log('\n--- JSON Output ---');
      console.log(JSON.stringify(data, null, 2));

      return data;
    } else {
      console.log('No data retrieved');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

if (require.main === module) {
  testScraper();
}

module.exports = { scrapeGSEStockData };
