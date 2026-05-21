const asyncHandler = require('express-async-handler');
const Article = require('../models/Article');
const { runPipeline } = require('../services/aiPipeline');
const { fetchResearchBrief } = require('../services/webScraper');
const { scoreArticle } = require('../services/seoScorer');
const { buildSuggestions } = require('../services/suggestions');

function countWords(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// @desc   Generate a new article end-to-end
// @route  POST /api/articles/generate
// @access Private
const generateArticle = asyncHandler(async (req, res) => {
  const {
    topic,
    primaryKeyword,
    secondaryKeywords = [],
    targetWordCount = 1200,
    headingsCount = 5,
    tone = 'professional',
    audience = 'general readers',
    language = 'English',
    articleType = 'blog',
    pointOfView = 'third',
    includeFaqs = true,
    includeMeta = true,
    includeImages = false,
  } = req.body;

  if (!topic) {
    res.status(400);
    throw new Error('Topic is required');
  }

  // Plan limit check
  if (req.user.wordsUsed + targetWordCount > req.user.wordsLimit) {
    res.status(402);
    throw new Error(
      `Plan limit reached. You have ${req.user.wordsLimit - req.user.wordsUsed} words remaining on the ${req.user.plan} plan.`
    );
  }

  // ---- Step 0: Research brief from competitor pages ---------------------
  const research = await fetchResearchBrief({
    topic,
    primaryKeyword,
    secondaryKeywords,
  });

  // ---- Steps 1-4: Multi-model pipeline ---------------------------------
  const result = await runPipeline({
    topic,
    brief: research.brief,
    primaryKeyword,
    secondaryKeywords,
    targetWordCount,
    headingsCount,
    tone,
    audience,
    language,
    articleType,
    pointOfView,
    includeFaqs,
    includeMeta,
  });

  // ---- Step 5: SEO scoring + suggestions -------------------------------
  const seoReport = scoreArticle({
    content: result.content,
    title: topic,
    metaTitle: result.metaTitle,
    metaDescription: result.metaDescription,
    primaryKeyword,
    secondaryKeywords,
    targetWordCount,
  });

  const suggestions = buildSuggestions({
    content: result.content,
    sources: research.sources,
    commonSubtopics: research.commonSubtopics,
    articleType,
    includeFaqs,
    topic,
  });

  // ---- Persist ----------------------------------------------------------
  const wordCount = countWords(result.content);
  const article = await Article.create({
    user: req.user._id,
    title: topic,
    metaTitle: result.metaTitle,
    metaDescription: result.metaDescription,
    content: result.content,
    primaryKeyword,
    secondaryKeywords,
    tone,
    audience,
    language,
    articleType,
    pointOfView,
    targetWordCount,
    includeFaqs,
    includeImages,
    wordCount,
    readingTimeMinutes: Math.max(1, Math.round(wordCount / 220)),
    seoScore: seoReport.overall,
    seoReport,
    aiScoreBefore: result.aiScoreBefore,
    aiScoreAfter: result.aiScoreAfter,
    sources: research.sources,
    suggestions,
    pipelineSteps: result.pipelineSteps,
    status: 'completed',
  });

  // Update plan usage
  req.user.wordsUsed += wordCount;
  await req.user.save();

  res.status(201).json({ article });
});

// @desc   List articles
// @route  GET /api/articles
// @access Private
const listArticles = asyncHandler(async (req, res) => {
  const { q, status, limit = 20, page = 1 } = req.query;
  const query = { user: req.user._id };
  if (status) query.status = status;
  if (q) query.title = { $regex: q, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Article.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-content -seoReport.suggestions -suggestions -sources'),
    Article.countDocuments(query),
  ]);

  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

// @desc   Get a single article
// @route  GET /api/articles/:id
// @access Private
const getArticle = asyncHandler(async (req, res) => {
  const article = await Article.findOne({ _id: req.params.id, user: req.user._id });
  if (!article) {
    res.status(404);
    throw new Error('Article not found');
  }
  res.json({ article });
});

// @desc   Update an article (e.g. after edits in the editor)
// @route  PUT /api/articles/:id
// @access Private
const updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findOne({ _id: req.params.id, user: req.user._id });
  if (!article) {
    res.status(404);
    throw new Error('Article not found');
  }
  const allowed = ['title', 'content', 'metaTitle', 'metaDescription', 'status'];
  allowed.forEach((k) => {
    if (k in req.body) article[k] = req.body[k];
  });

  // Re-score if content changed
  if ('content' in req.body) {
    const seoReport = scoreArticle({
      content: article.content,
      title: article.title,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      primaryKeyword: article.primaryKeyword,
      secondaryKeywords: article.secondaryKeywords,
      targetWordCount: article.targetWordCount,
    });
    article.seoReport = seoReport;
    article.seoScore = seoReport.overall;
    article.wordCount = countWords(article.content);
    article.readingTimeMinutes = Math.max(1, Math.round(article.wordCount / 220));
  }

  await article.save();
  res.json({ article });
});

// @desc   Delete an article
// @route  DELETE /api/articles/:id
// @access Private
const deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!article) {
    res.status(404);
    throw new Error('Article not found');
  }
  res.json({ message: 'Deleted' });
});

module.exports = {
  generateArticle,
  listArticles,
  getArticle,
  updateArticle,
  deleteArticle,
};
