const puppeteer = require('puppeteer');

const URL = 'https://simplywall.st/stocks/gh/market-cap-large';

async function getStockData() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920x1080',
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to page...');
    await page.goto(URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('Waiting for table to load...');
    await page.waitForSelector('tr[data-cy-id="stocks-table-row"]', {
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('Extracting stock data...');
    const stocks = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        'tr[data-cy-id="stocks-table-row"]',
      );
      const stocksList = [];

      rows.forEach((row, index) => {
        try {
          // Get symbol from the div with class text-accent
          const symbolElement = row.querySelector('.text-accent');
          // Get name from the button with opacity-50
          const nameElement = row.querySelector('button.opacity-50');

          if (symbolElement) {
            const cells = row.querySelectorAll('td');

            stocksList.push({
              index: index + 1,
              symbol: symbolElement ? symbolElement.textContent.trim() : '',
              name: nameElement ? nameElement.textContent.trim() : '',
              price: cells[2] ? cells[2].textContent.trim() : '',
              '7D_Return': cells[3] ? cells[3].textContent.trim() : '',
              '1Y_Return': cells[4] ? cells[4].textContent.trim() : '',
              marketCap: cells[5] ? cells[5].textContent.trim() : '',
              analystsTarget: cells[6] ? cells[6].textContent.trim() : '',
              valuation: cells[7] ? cells[7].textContent.trim() : '',
              growth: cells[8] ? cells[8].textContent.trim() : '',
              divYield: cells[9] ? cells[9].textContent.trim() : '',
              industry: cells[10] ? cells[10].textContent.trim() : '',
              watchlisted:
                row.querySelector('svg[data-cy-id="solid-star"]') !== null,
            });
          }
        } catch (e) {
          console.error('Error processing row:', e);
        }
      });

      return stocksList;
    });

    console.log(`Found ${stocks.length} stocks`);

    return {
      metadata: {
        source: URL,
        scrapedAt: new Date().toISOString(),
        totalStocks: stocks.length,
      },
      stocks,
    };
  } catch (error) {
    console.error('Error in getStockData:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
      stocks: [],
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

if (require.main === module) {
  getStockData()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch(console.error);
}

module.exports = getStockData;
