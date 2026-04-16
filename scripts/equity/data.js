const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const scrapeGSE = async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('https://gsemarketwatch.com/', {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    await page
      .waitForFunction(
        () => {
          const html = document.body.innerHTML;
          return (
            html.includes('GLC') ||
            html.includes('MTNGH') ||
            html.includes('GOIL') ||
            html.includes('SCB')
          );
        },
        { timeout: 30000 },
      )
      .catch(() => {});

    await page
      .waitForSelector('.owl-item .item table.symbols-table', {
        timeout: 20000,
      })
      .catch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const html = await page.content();

    if (!html.includes('GLC') && !html.includes('MTNGH')) {
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log('Debug screenshot saved as debug-screenshot.png');
      await browser.close();
      return [];
    }

    const stockData = await page.evaluate(() => {
      const stocks = [];
      const tables = document.querySelectorAll('table.symbols-table');
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 14) return;
          const stock = {};
          cells.forEach((cell) => {
            const dataTitle = cell.getAttribute('data-title');
            if (dataTitle) {
              let value = cell.textContent.trim();
              if (
                dataTitle === 'net_change' ||
                dataTitle === 'percent_change'
              ) {
                const tdValue = cell.querySelector('.td-value');
                if (tdValue) {
                  value = tdValue.textContent.trim();
                }
              }
              if (value && !isNaN(value.replace(/,/g, ''))) {
                stock[dataTitle] = parseFloat(value.replace(/,/g, ''));
              } else {
                stock[dataTitle] = value;
              }
            }
          });
          if (stock.symbol) {
            stocks.push(stock);
          }
        });
      });
      return stocks;
    });

    const uniqueStocks = [];
    const seenSymbols = new Set();
    stockData.forEach((stock) => {
      if (!seenSymbols.has(stock.symbol)) {
        seenSymbols.add(stock.symbol);
        uniqueStocks.push(stock);
      }
    });

    const formattedData = uniqueStocks.map((stock) => ({
      symbol: stock.symbol,
      bid_size: stock.bid_volume,
      bid_price: stock.bid_price,
      ask_size: stock.ask_volume,
      ask_price: stock.ask_price,
      last_price: stock.last_trade_price,
      last_volume: stock.last_trade_volume,
      total_volume: stock.total_trade_volume,
      total_value: stock.total_trade_value,
      open: stock.open_price,
      high: stock.high_price,
      low: stock.low_price,
      close: stock.close_price,
      change: stock.net_change,
      percent_change: stock.percent_change,
    }));

    console.log('Scraped GSE data:', JSON.stringify(formattedData, null, 2));
    console.log(`Total stocks scraped: ${formattedData.length}`);

    return formattedData;
  } catch (error) {
    console.error('Error scraping GSE data:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

scrapeGSE()
  .then((data) => {
    console.log('Scraping completed successfully');
  })
  .catch((err) => {
    console.error('Scraping failed:', err);
  });

module.exports = { scrapeGSE };
