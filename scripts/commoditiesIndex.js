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

const commoditiesSources = [
  scrapeBrentCrude,
  scrapeGold,
  scrapeSilver,
  scrapeCopper,
  scrapeSteel,
  scrapeLithium,
  scrapeCocoa,
  scrapeSoybeans,
  scrapeCoffee,
  scrapeWheat,
  scrapeSunflowerOil,
  scrapeSugar,
  scrapeRubber,
  scrapeCrudeOil,
  scrapeNaturalGas,
  scrapeGasoline,
];

module.exports = commoditiesSources;
