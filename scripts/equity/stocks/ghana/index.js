const { scrapeAADGhana } = require('./AADS');
const { scrapeACCESSGhana } = require('./ACCESS');
const { scrapeADBGhana } = require('./ADB');
const { scrapeAGAGhana } = require('./AGA');
const { scrapeALLGhana } = require('./ALLGH');
const { scrapeASGGhana } = require('./ASG');
const { scrapeBOPPGhana } = require('./BOPP');
const { scrapeCALGhana } = require('./CAL');
const { scrapeCLYDGhana } = require('./CLYD');
const { scrapeCMLTGhana } = require('./CMLT');
const { scrapeCPCGhana } = require('./CPC');
const { scrapeDASLPharmaGhana } = require('./DASPHARMA');
const { scrapeDIGICUTGhana } = require('./DIGICUT');
const { scrapeEBGGhana } = require('./EGH');
const { scrapeEGLGhana } = require('./EGL');
const { scrapeETIGhana } = require('./ETI');
const { scrapeFABGhana } = require('./FAB');
const { scrapeFMLGhana } = require('./FML');
const { scrapeGCBGhana } = require('./GCB');
const { scrapeGGBLGhana } = require('./GGBL');
const { scrapeGLDGhana } = require('./GLD');
const { scrapeGOILGhana } = require('./GOIL');
const { scrapeHORDSGhana } = require('./HORDS');
const { scrapeMACGhana } = require('./MAC');
const { scrapeMMHGhana } = require('./MMH');
const { scrapeMTNGhana } = require('./MTNGH');
const { scrapeRBGhana } = require('./RBGH');
const { scrapeSAMBAFoods } = require('./SAMBA');
const { scrapeSCBGhana } = require('./SCB');
const { scrapeSCBPrefGhana } = require('./SCBPREF');
const { scrapeSICGhana } = require('./SIC');
const { scrapeSOGEGHGhana } = require('./SOGEGH');
const { scrapeTBLGhana } = require('./TBL');
const { scrapeTLWGhana } = require('./TLW');
const { scrapeTOTALGhana } = require('./TOTAL');
const { scrapeUNILGhana } = require('./UNIL');

const gseSources = [
  scrapeAADGhana,
  scrapeACCESSGhana,
  scrapeADBGhana,
  scrapeAGAGhana,
  scrapeALLGhana,
  scrapeASGGhana,
  scrapeBOPPGhana,
  scrapeCALGhana,
  scrapeCLYDGhana,
  scrapeCMLTGhana,
  scrapeCPCGhana,
  scrapeDASLPharmaGhana,
  scrapeDIGICUTGhana,
  scrapeEBGGhana,
  scrapeEGLGhana,
  scrapeETIGhana,
  scrapeFABGhana,
  scrapeFMLGhana,
  scrapeGCBGhana,
  scrapeGGBLGhana,
  scrapeGLDGhana,
  scrapeGOILGhana,
  scrapeHORDSGhana,
  scrapeMACGhana,
  scrapeMMHGhana,
  scrapeMTNGhana,
  scrapeRBGhana,
  scrapeSAMBAFoods,
  scrapeSCBGhana,
  scrapeSCBPrefGhana,
  scrapeSICGhana,
  scrapeSOGEGHGhana,
  scrapeTBLGhana,
  scrapeTLWGhana,
  scrapeTOTALGhana,
  scrapeUNILGhana,
];

module.exports = gseSources;
