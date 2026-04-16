const { scrapeCAC40 } = require('./indexes/cac-40');
const { scrapeDAX } = require('./indexes/de-40');
const { scrapeFTSE100 } = require('./indexes/ftse-100');
const { scrapeGhanaStockIndex } = require('./indexes/gse-ci');
const { scrapeSensex } = require('./indexes/india');
const { scrapeNikkei225 } = require('./indexes/japan');
const { scrapeJSEIndex } = require('./indexes/jse-allshare');
const { scrapeNSEASI } = require('./indexes/nairobi-allshare');
const { scrapeNigerianStockIndex } = require('./indexes/nse-allshare');
const { scrapeShanghaiComposite } = require('./indexes/shanghai');
const { scrapeDJIA } = require('./indexes/us-50');
const { scrapeNASDAQ100 } = require('./indexes/us-100');
const { scrapeSP500 } = require('./indexes/us-sp-500');

const indicesSources = [
  scrapeCAC40,
  scrapeDAX,
  scrapeFTSE100,
  scrapeGhanaStockIndex,
  scrapeSensex,
  scrapeNikkei225,
  scrapeJSEIndex,
  scrapeNSEASI,
  scrapeNigerianStockIndex,
  scrapeShanghaiComposite,
  scrapeDJIA,
  scrapeNASDAQ100,
  scrapeSP500,
];

module.exports = indicesSources;
