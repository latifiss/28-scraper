const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();

    await page.goto(
      'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/',
      {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      },
    );

    await page.waitForSelector('table', { timeout: 10000 });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const results = await page.evaluate(() => {
      const data = [];
      const tables = document.querySelectorAll('table');

      tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            const date = cells[0]?.textContent?.trim() || '';
            const currency = cells[1]?.textContent?.trim() || '';
            const currencyPair = cells[2]?.textContent?.trim() || '';
            const buyingRate = cells[3]?.textContent?.trim() || '';
            const sellingRate = cells[4]?.textContent?.trim() || '';
            const midRate = cells[5]?.textContent?.trim() || '';

            if (currencyPair && /^[A-Z]{6}$/.test(currencyPair)) {
              data.push({
                date,
                currency,
                currency_pair: currencyPair,
                buying_rate: parseFloat(buyingRate) || 0,
                selling_rate: parseFloat(sellingRate) || 0,
                mid_rate: parseFloat(midRate) || 0,
              });
            }
          }
        });
      });

      return data;
    });

    const gbpghs = results.filter((r) => r.currency_pair === 'GBPGHS');
    const usdghs = results.filter((r) => r.currency_pair === 'USDGHS');
    const eurghs = results.filter((r) => r.currency_pair === 'EURGHS');

    console.log('GBPGHS:', JSON.stringify(gbpghs, null, 2));
    console.log('USDGHS:', JSON.stringify(usdghs, null, 2));
    console.log('EURGHS:', JSON.stringify(eurghs, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
