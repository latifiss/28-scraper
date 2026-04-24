const axios = require('axios');
const cheerio = require('cheerio');

const url =
  'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/';

(async () => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);
    const results = [];

    $('tr.even, tr.odd').each((_, row) => {
      const currencyPair = $(row)
        .find('td.column-cd_currency_pair')
        .text()
        .trim();

      if (currencyPair === 'GBPGHS') {
        const dateCell = $(row).find('td.column-dt_date');
        dateCell.find('.responsiveExpander').remove();
        const date = dateCell.text().trim();

        results.push({
          date,
          currency: $(row).find('td.column-ds_currency').text().trim(),
          currency_pair: currencyPair,
          buying_rate: parseFloat(
            $(row).find('td.column-vl_bid').text().trim(),
          ),
          selling_rate: parseFloat(
            $(row).find('td.column-vl_offer').text().trim(),
          ),
          mid_rate: parseFloat($(row).find('td.column-vl_mid').text().trim()),
        });
      }
    });

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
})();
