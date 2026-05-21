const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  humanizeText,
  aiDetect,
  paraphrase,
  titleSuggestions,
  seoScore,
  rewriteInline,
} = require('../controllers/toolsController');

const router = express.Router();

router.use(protect);

router.post('/humanize', humanizeText);
router.post('/ai-detect', aiDetect);
router.post('/paraphrase', paraphrase);
router.post('/title-suggestions', titleSuggestions);
router.post('/seo-score', seoScore);
router.post('/rewrite', rewriteInline);

module.exports = router;
