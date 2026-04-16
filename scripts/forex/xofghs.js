const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGHSXOF = async () => {
  try {
    const url = 'https://tradingeconomics.com/ghsxof:cur';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the table row with the data
    const row = $('tr[data-symbol="GHSXOF:CUR"]');

    if (row.length === 0) {
      throw new Error('Could not find the currency data row');
    }

    const currentPrice = parseFloat(row.find('td:nth-child(2)').text().trim());
    const valueChange = parseFloat(row.find('td:nth-child(4)').text().trim());
    const dailyPercentageChange = parseFloat(
      row.find('td:nth-child(5)').text().trim().replace('%', '')
    );
    const yearlyChange = parseFloat(
      row.find('td:nth-child(6)').text().trim().replace('%', '')
    );

    const forexData = {
      code: 'ghsxof',
      name: 'GHS/XOF',
      from_currency: 'Ghanaian Cedi',
      from_code: 'GHS',
      to_currency: 'West African CFA Franc',
      to_code: 'XOF',
      currentPrice: currentPrice,
      percentage_change: dailyPercentageChange,
      monthly_change: '',
      yearly_change: yearlyChange,
      price_history: [
        {
          date: new Date(),
          price: currentPrice,
          percentage_change: dailyPercentageChange,
        },
      ],
      last_updated: new Date(),
    };

    console.log('Scraped data:', forexData);
    return forexData;
  } catch (error) {
    console.error('Error scraping data:', error);
    throw error;
  }
};

module.exports = {
  scrapeGHSXOF,
};

if (require.main === module) {
  scrapeGHSXOF()
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}
