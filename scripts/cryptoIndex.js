const { fetchBNB } = require('./crypto/binance');
const { fetchBitcoin } = require('./crypto/bitcoin');
const { fetchCardano } = require('./crypto/cardano');
const { fetchChainlink } = require('./crypto/chainlink');
const { fetchDogecoin } = require('./crypto/dogecoin');
const { fetchEth } = require('./crypto/ethereum');
const { fetchSolana } = require('./crypto/solana');
const { fetchTether } = require('./crypto/tether');
const { fetchXrp } = require('./crypto/xrp');
const { monitored } = require('../monitoring');

const cryptoSources = [
  fetchBNB, fetchBitcoin, fetchCardano, fetchChainlink, fetchDogecoin,
  fetchEth, fetchSolana, fetchTether, fetchXrp,
].map((fn) => monitored({
  id: 'crypto-' + fn.name.replace(/^fetch/i, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  name: fn.name.replace(/^fetch/, ''),
  category: 'cryptocurrency',
  expectedIntervalMs: 10 * 60 * 1000,
  staleAfterMs: 45 * 60 * 1000,
}, fn));

module.exports = cryptoSources;
