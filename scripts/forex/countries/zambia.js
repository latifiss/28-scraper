const axios = require('axios');
const cheerio = require('cheerio');

const scrapeZambiaCurrencies = async () => {
  try {
    const url = 'https://tradingeconomics.com/zambia/currency';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);

    const currencies = ['USDZMW'];
    const result = {};

    currencies.forEach((currency) => {
      const row = $(`tr[data-symbol="${currency}:CUR"]`);

      if (row.length === 0) {
        console.warn(
          `Could not find data row for ${currency}. The symbol attribute might differ.`,
        );
        return;
      }

      const priceText = row.find('td[id="p"]').text().trim().replace(/,/g, '');
      const valueChangeText = row
        .find('td[id="nch"]')
        .text()
        .trim()
        .replace(/,/g, '');
      const dailyPctText = row
        .find('td[id="pch"]')
        .text()
        .trim()
        .replace('%', '');
      const yearlyPctText = row
        .find('td:nth-child(6)')
        .text()
        .trim()
        .replace('%', '');

      const fromCode = currency.substring(0, 3);
      const toCode = currency.substring(3, 6);

      const currencyData = {
        code: currency.toLowerCase(),
        name: `${fromCode}/${toCode}`,
        from_currency: fromCode,
        from_code: fromCode,
        to_currency: toCode,
        to_code: toCode,
        currentPrice: parseFloat(priceText),
        value_change: parseFloat(valueChangeText),
        percentage_change: parseFloat(dailyPctText),
        yearly_change: parseFloat(yearlyPctText),
        price_history: [
          {
            date: new Date(),
            price: parseFloat(priceText),
            percentage_change: parseFloat(dailyPctText),
          },
        ],
        last_updated: new Date(),
      };

      result[currency.toLowerCase()] = currencyData;
    });

    console.log('Scraped Zambia currency data:', result);
    return result;
  } catch (error) {
    console.error('Error scraping Zambia currency data:', error);
    throw error;
  }
};

module.exports = {
  scrapeZambiaCurrencies,
};

if (require.main === module) {
  scrapeZambiaCurrencies()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => console.error(err));
}
