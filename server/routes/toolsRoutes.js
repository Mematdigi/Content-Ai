const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  humanizeText,
  aiDetect,
  paraphrase,
  titleSuggestions,
  seoScore,
  rewriteInline,
  autoPickTopic,
  extractTextFromFile,
} = require('../controllers/toolsController');

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.use(protect);

router.post('/humanize', humanizeText);
router.post('/ai-detect', aiDetect);
router.post('/paraphrase', paraphrase);
router.post('/title-suggestions', titleSuggestions);
router.post('/seo-score', seoScore);
router.post('/rewrite', rewriteInline);
router.post('/auto-pick-topic', autoPickTopic);
router.post('/extract-text', upload.single('file'), extractTextFromFile);

module.exports = router;

