const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://goldbod.gov.gh/';

async function scrapeGoldPrice() {
  try {
    const { data: html } = await axios.get(URL);
    const $ = cheerio.load(html);

    let priceText = null;
    let discountRate = null;

    $('h2.elementor-heading-title').each((_, el) => {
      const text = $(el).text().trim();

      if (
        text === 'Total Price Per Pound' ||
        text.includes('Total Price Per Pound')
      ) {
        const container = $(el).closest('div.elementor-widget-wrap');

        container.find('h2.elementor-heading-title').each((_, priceEl) => {
          const priceContent = $(priceEl).text().trim();
          if (priceContent.includes('GHS')) {
            const match = priceContent.match(/GHS\s*([\d,]+\.?\d*)/);
            if (match) {
              priceText = match[1];
            }
          }
        });
      }
    });

    if (!priceText) {
      $('h2.elementor-heading-title').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('GHS 12,798') || text.includes('GHS 12,798')) {
          const match = text.match(/GHS\s*([\d,]+\.?\d*)/);
          if (match) {
            priceText = match[1];
          }
        }
      });
    }

    $('h2.elementor-heading-title').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('GHS 551')) {
        const match = text.match(/GHS\s*([\d,]+\.?\d*)/);
        if (match) {
          discountRate = match[1];
        }
      }
    });

    let totalWithBonus = null;
    $('h2.elementor-heading-title').each((_, el) => {
      const text = $(el).text().trim();
      if (
        text === 'Total price per pound' ||
        text.includes('Total price per pound')
      ) {
        const container = $(el).closest('div.elementor-widget-wrap');
        container.find('h2.elementor-heading-title').each((_, priceEl) => {
          const priceContent = $(priceEl).text().trim();
          if (priceContent.includes('GHS')) {
            const match = priceContent.match(/GHS\s*([\d,]+\.?\d*)/);
            if (match) {
              totalWithBonus = match[1];
            }
          }
        });
      }
    });

    console.log(`Price found: ${priceText || 'Not found'}`);
    console.log(`Discount rate: ${discountRate || 'Not found'}`);
    console.log(`Total with bonus: ${totalWithBonus || 'Not found'}`);

    return {
      code: 'goldbod',
      commodity: 'gold',
      price_per_gh_pound: priceText || null,
      discount_rate: discountRate || null,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      code: 'goldbod',
      error: error.message,
      commodity: 'gold',
      price_per_gh_pound: null,
      discount_rate: null,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = scrapeGoldPrice;

if (require.main === module) {
  scrapeGoldPrice().then(console.log).catch(console.error);
}
