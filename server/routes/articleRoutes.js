const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  generateArticle,
  listArticles,
  getArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/articleController');

const router = express.Router();

// Publicly view article
router.get('/:id', getArticle);

router.use(protect);

router.post('/generate', generateArticle);
router.get('/', listArticles);
router.put('/:id', updateArticle);
router.delete('/:id', deleteArticle);

module.exports = router;
