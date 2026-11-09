const { scrapeBrentCrude } = require('./commodities/brent');
const { scrapeGold } = require('./commodities/gold');
const { scrapeSilver } = require('./commodities/silver');
const { scrapeCopper } = require('./commodities/copper');
const { scrapeSteel } = require('./commodities/steel');
const { scrapeLithium } = require('./commodities/lithium');
const { scrapeCocoa } = require('./commodities/cocoa');
const { scrapeSoybeans } = require('./commodities/soybeans');
const { scrapeCoffee } = require('./commodities/coffee');
const { scrapeWheat } = require('./commodities/wheat');
const { scrapeSunflowerOil } = require('./commodities/sunflower-oil');
const { scrapeSugar } = require('./commodities/sugar');
const { scrapeRubber } = require('./commodities/rubber');
const { scrapeCrudeOil } = require('./commodities/crude-oil');
const { scrapeNaturalGas } = require('./commodities/natural-gas');
const { scrapeGasoline } = require('./commodities/gasoline');
const { monitored } = require('../monitoring');

const commoditiesSources = [
  scrapeBrentCrude, scrapeGold, scrapeSilver, scrapeCopper, scrapeSteel,
  scrapeLithium, scrapeCocoa, scrapeSoybeans, scrapeCoffee, scrapeWheat,
  scrapeSunflowerOil, scrapeSugar, scrapeRubber, scrapeCrudeOil,
  scrapeNaturalGas, scrapeGasoline,
].map((fn) => monitored({
  id: 'commodity-' + fn.name.replace(/^scrape/i, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  name: fn.name.replace(/^scrape/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
  category: 'commodities',
  expectedIntervalMs: 5 * 60 * 1000,
  staleAfterMs: 30 * 60 * 1000,
}, fn));

module.exports = commoditiesSources;
