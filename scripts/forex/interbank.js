const puppeteer = require('puppeteer');

async function interbankScraper() {
  console.log(
    '🔄 Fetching latest interbank FX rates from Bank of Ghana (using Puppeteer)...\n',
  );

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );

    console.log('🌐 Navigating to page...');
    await page.goto(
      'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/',
      {
        waitUntil: 'networkidle2',
        timeout: 30000,
      },
    );

    console.log('⏳ Waiting for table data to load...');
    await page.waitForSelector('#table_2 tbody tr', { timeout: 10000 });

    const rates = await page.evaluate(() => {
      const rows = document.querySelectorAll('#table_2 tbody tr');
      const data = [];

      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 6) {
          data.push({
            index: index + 1,
            date: cells[0].textContent.trim(),
            currency: cells[1].textContent.trim(),
            currencyPair: cells[2].textContent.trim(),
            buying: parseFloat(cells[3].textContent.trim()),
            selling: parseFloat(cells[4].textContent.trim()),
            midRate: parseFloat(cells[5].textContent.trim()),
          });
        }
      });

      return data;
    });

    const weightedMedianRate = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      const match = bodyText.match(
        /Day['’]s Weighted Median Rate:\s*([\d.]+)/i,
      );
      return match ? match[1] : 'N/A';
    });

    const summary = {
      scrapedAt: new Date().toISOString(),
      source:
        'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/',
      date: rates.length > 0 ? rates[0].date : 'N/A',
      totalCurrencies: rates.length,
      weightedMedianRate: weightedMedianRate,
    };

    const result = {
      metadata: summary,
      rates: rates,
    };

    console.log('✅ Successfully scraped', rates.length, 'currency pairs');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(`❌ Scraping failed: ${error.message}`);
    const errorResult = {
      error: error.message,
      timestamp: new Date().toISOString(),
      rates: [],
    };
    console.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

if (require.main === module) {
  interbankScraper().catch(console.error);
}

module.exports = interbankScraper;
