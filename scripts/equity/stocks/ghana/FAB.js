const puppeteer = require('puppeteer');

const scrapeFABGhana = async () => {
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

    await page.goto('https://africanfinancials.com/company/gh-fab/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('.mod-tearsheet-overview_quote_bar', {
      timeout: 10000,
    });

    const companyData = await page.evaluate(() => {
      const cleanText = (text) =>
        text ? text.replace(/\s+/g, ' ').trim() : '';

      const quoteItems = document.querySelectorAll(
        '.mod-tearsheet-overview_quote_bar li',
      );
      const quoteSnapshot = {};

      quoteItems.forEach((item) => {
        const labelEl = item.querySelector('.mod-ui-data-list_label');
        const valueEl = item.querySelector('.mod-ui-data-list_value');
        if (labelEl && valueEl) {
          const label = cleanText(labelEl.textContent);
          let value = cleanText(valueEl.textContent);
          if (label.includes('Change') || label.includes('change')) {
            const cleanValue = valueEl.innerText.replace(/[↓↑]/g, '').trim();
            value = cleanValue;
          }
          quoteSnapshot[label] = value;
        }
      });

      const lastUpdatedEl = document.querySelector('.mod-disclaimer');
      const lastUpdated = lastUpdatedEl
        ? cleanText(lastUpdatedEl.textContent)
            .replace('Last Updated:', '')
            .trim()
        : null;

      const companyNameEl = document.querySelector('h1.companyTitle');
      const companyName = companyNameEl
        ? cleanText(companyNameEl.textContent)
        : 'First Atlantic Bank PLC (FAB.gh)';

      return {
        companyName: companyName,
        symbol: 'FAB',
        exchange: 'Ghana Stock Exchange',
        lastUpdated: lastUpdated,
        quoteSnapshot: quoteSnapshot,
      };
    });

    return companyData;
  } catch (error) {
    console.error('Error scraping First Atlantic Bank PLC:', error);
    return { error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

if (require.main === module) {
  scrapeFABGhana()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((err) => console.error(err));
}

module.exports = { scrapeFABGhana };
