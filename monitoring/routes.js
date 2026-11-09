const express = require('express');
const rateLimit = require('express-rate-limit');
const monitor = require('./index');

const router = express.Router();
router.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

function authorize(req, res, next) {
  const expected = process.env.SCRAPER_MONITORING_API_KEY;
  if (!expected) return next();
  const supplied = req.get('x-monitoring-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (supplied !== expected) return res.status(401).json({ success: false, error: 'Unauthorized' });
  return next();
}
router.use(authorize);

router.get('/health', async (req, res, next) => {
  try { res.json({ success: true, data: await monitor.getOverview() }); }
  catch (error) { next(error); }
});

router.get('/scrapers', (req, res) => {
  const data = monitor.listScrapers();
  res.json({ success: true, count: data.length, data });
});

router.get('/scrapers/:id', (req, res) => {
  const data = monitor.getScraper(req.params.id);
  if (!data) return res.status(404).json({ success: false, error: 'Scraper not found', scraperId: req.params.id });
  return res.json({ success: true, data });
});

router.get('/scrapers/:id/runs', async (req, res, next) => {
  try {
    if (!monitor.getScraper(req.params.id)) return res.status(404).json({ success: false, error: 'Scraper not found' });
    const data = await monitor.getRuns(req.params.id, req.query.limit);
    res.json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
});

router.get('/runs', async (req, res, next) => {
  try { const data = await monitor.getRuns(null, req.query.limit); res.json({ success: true, count: data.length, data }); }
  catch (error) { next(error); }
});

module.exports = router;
