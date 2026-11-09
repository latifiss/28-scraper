const { scrapeUSDGHS } = require('./forex/usdghs');
const { scrapeEURGHS } = require('./forex/eurghs');
const { scrapeGBPGHS } = require('./forex/gbpghs');
const { scrapeCADGHS } = require('./forex/cadghs');
const { scrapeCNYGHS } = require('./forex/cnyghs');
const { scrapeNGNGHS } = require('./forex/ngnghs');
const { scrapeZARGHS } = require('./forex/zarghs');
const { scrapeGHSXOF } = require('./forex/xofghs');
const { scrapeCHFGHS } = require('./forex/chfghs');
const { scrapeJPYGHS } = require('./forex/jpyghs');
const { monitored } = require('../monitoring');

const forexSources = [
  scrapeUSDGHS, scrapeEURGHS, scrapeGBPGHS, scrapeCADGHS, scrapeCNYGHS,
  scrapeNGNGHS, scrapeZARGHS, scrapeGHSXOF, scrapeCHFGHS, scrapeJPYGHS,
].map((fn) => monitored({
  id: 'forex-' + fn.name.replace(/^scrape/i, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  name: fn.name.replace(/^scrape/, ''),
  category: 'forex',
  expectedIntervalMs: 5 * 60 * 1000,
  staleAfterMs: 30 * 60 * 1000,
}, fn));

module.exports = forexSources;
