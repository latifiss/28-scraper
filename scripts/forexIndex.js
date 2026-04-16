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

const forexSources = [
  scrapeUSDGHS,
  scrapeEURGHS,
  scrapeGBPGHS,
  scrapeCADGHS,
  scrapeCNYGHS,
  scrapeNGNGHS,
  scrapeZARGHS,
  scrapeGHSXOF,
  scrapeCHFGHS,
  scrapeJPYGHS,
];

module.exports = forexSources;
