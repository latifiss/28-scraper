const { fetchBNB } = require('./crypto/binance');
const { fetchBitcoin } = require('./crypto/bitcoin');
const { fetchCardano } = require('./crypto/cardano');
const { fetchChainlink } = require('./crypto/chainlink');
const { fetchDogecoin } = require('./crypto/dogecoin');
const { fetchEth } = require('./crypto/ethereum');
const { fetchSolana } = require('./crypto/solana');
const { fetchTether } = require('./crypto/tether');
const { fetchXrp } = require('./crypto/xrp');

const cryptoSources = [
  fetchBNB,
  fetchBitcoin,
  fetchCardano,
  fetchChainlink,
  fetchDogecoin,
  fetchEth,
  fetchSolana,
  fetchTether,
  fetchXrp,
];

module.exports = cryptoSources;
