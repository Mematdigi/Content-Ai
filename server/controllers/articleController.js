const asyncHandler = require('express-async-handler');
const Article = require('../models/Article');
const User = require('../models/User');
const { runPipeline } = require('../services/aiPipeline');
const { fetchResearchBrief } = require('../services/webScraper');
const { scoreArticle } = require('../services/seoScorer');
const { buildSuggestions } = require('../services/suggestions');
const { replaceImagePlaceholders } = require('../services/imageService');
const { findRelatedArticles, insertInternalLinks } = require('../services/internalLinker');

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
    referenceMode = 'auto',
    customUrls = [],
    customDocText = '',
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
    articleType,
    referenceMode,
    customUrls,
    customDocText,
  });

  // ---- Guard: refuse to generate if time-sensitive data is missing ------
  if (research.insufficientData) {
    const dateLabel = research.temporalInfo
      ? `${research.temporalInfo.label} (${research.temporalInfo.date})`
      : 'the requested date';
    const noDataContent = [
      `# ${topic}`,
      '',
      `No verified information was found for **${dateLabel}**.`,
      '',
      `We searched multiple sources but could not retrieve confirmed schedules, fixtures, or event details for this date. ` +
      `This may be because the official schedule has not been published yet, or because real-time data is currently unavailable.`,
      '',
      '**What you can do:**',
      '- Check the official website of the tournament or league for the latest schedule.',
      '- Try again closer to the event date when official fixtures are typically announced.',
      '- Search for a specific matchup (e.g., "Team A vs Team B") instead of a general date-based query.',
    ].join('\n');

    const wordCount = countWords(noDataContent);
    const article = await Article.create({
      user: req.user._id,
      title: topic,
      metaTitle: '',
      metaDescription: '',
      content: noDataContent,
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
      readingTimeMinutes: 1,
      seoScore: 0,
      seoReport: {},
      aiScoreBefore: 0,
      aiScoreAfter: 0,
      sources: research.sources,
      suggestions: [{ type: 'subtopic', text: 'Insufficient real-time data', detail: 'Try a more specific query or check back when official schedules are published.' }],
      pipelineSteps: [{ step: 'research', model: 'web-scraper', durationMs: 0, status: 'error' }],
      images: [],
      status: 'completed',
    });

    return res.status(201).json({ article, insufficientData: true });
  }

  // ---- Steps 1-4: Multi-model pipeline ---------------------------------
  const result = await runPipeline({
    topic,
    brief: research.brief,
    isHypothetical: research.isHypothetical,
    insufficientData: research.insufficientData || false,
    contentMode: research.contentMode || 'knowledge',
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
    includeImages,
    authorName: req.user.name,
  });

  // ---- Step 4.5: Replace image placeholders with real images ------------
  const { content: contentWithImages, images: fetchedImages } =
    await replaceImagePlaceholders(result.content);
  result.content = contentWithImages;
  result.images = [...(result.images || []), ...fetchedImages];

  // ---- Step 4.6: Add internal links to related articles ----------------
  const relatedArticles = await findRelatedArticles(req.user._id, primaryKeyword, topic);
  if (relatedArticles.length > 0) {
    const siteUrl = process.env.SITE_URL || '';
    result.content = insertInternalLinks(result.content, relatedArticles, siteUrl);
  }

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
    images: result.images || [],
    status: 'completed',
  });

  // Update plan usage
  // Update plan usage atomically to prevent Mongoose VersionError / validation conflicts
  await User.updateOne(
    { _id: req.user._id },
    { $inc: { wordsUsed: wordCount } }
  );

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
