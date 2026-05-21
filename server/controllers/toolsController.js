const asyncHandler = require('express-async-handler');
const { humanize, estimateAiScore } = require('../services/humanizer');
const { scoreArticle } = require('../services/seoScorer');
const { smartComplete } = require('../services/aiPipeline');

// @desc   Humanize arbitrary text
// @route  POST /api/tools/humanize
const humanizeText = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('text is required');
  }
  const result = humanize(text);
  res.json(result);
});

// @desc   Estimate AI-likeness score for arbitrary text
// @route  POST /api/tools/ai-detect
const aiDetect = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('text is required');
  }
  const score = estimateAiScore(text);
  res.json({ score, verdict: score >= 60 ? 'Likely AI' : score >= 30 ? 'Mixed' : 'Likely human' });
});

// @desc   Paraphrase text via LLM
// @route  POST /api/tools/paraphrase
const paraphrase = asyncHandler(async (req, res) => {
  const { text, tone = 'natural' } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('text is required');
  }
  const system = `You rewrite text to keep its meaning but change every sentence's structure. Tone: ${tone}. Return only the rewritten text.`;
  const { text: rewritten, model } = await smartComplete('anthropic', system, text, { maxTokens: 1500 });
  res.json({ text: rewritten, model });
});

// @desc   Title suggestions
// @route  POST /api/tools/title-suggestions
const titleSuggestions = asyncHandler(async (req, res) => {
  const { topic, keyword, count = 10 } = req.body;
  if (!topic) {
    res.status(400);
    throw new Error('topic is required');
  }
  const system =
    'You write irresistible blog titles. Output ONLY a numbered list, no commentary.';
  const prompt = `Generate ${count} catchy, SEO-friendly blog titles about "${topic}"${
    keyword ? ` that include or relate to the keyword "${keyword}"` : ''
  }. Mix curiosity, listicles, how-tos, and benefit-driven phrasing.`;
  const { text, model } = await smartComplete('openai', system, prompt, { maxTokens: 800 });

  // Parse numbered list -> array
  const titles = text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 4 && line.length < 200);

  res.json({ titles, model });
});

// @desc   Score arbitrary content for SEO
// @route  POST /api/tools/seo-score
const seoScore = asyncHandler(async (req, res) => {
  const { content, title, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, targetWordCount } = req.body;
  if (!content) {
    res.status(400);
    throw new Error('content is required');
  }
  const report = scoreArticle({
    content,
    title,
    metaTitle,
    metaDescription,
    primaryKeyword,
    secondaryKeywords,
    targetWordCount,
  });
  res.json({ report });
});

// @desc   Inline rewrite (rephrase, expand, shorten, formal, casual)
// @route  POST /api/tools/rewrite
const rewriteInline = asyncHandler(async (req, res) => {
  const { text, action = 'rephrase' } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('text is required');
  }
  const instructions = {
    rephrase: 'Rephrase keeping meaning identical.',
    expand: 'Expand to roughly 1.5x the original length, adding helpful detail.',
    shorten: 'Tighten to roughly half the original length without losing the point.',
    formal: 'Rewrite in a formal, professional tone.',
    casual: 'Rewrite in a casual, friendly tone.',
  };
  const system = `You rewrite short pieces of text. ${instructions[action] || instructions.rephrase} Return only the rewritten text.`;
  const { text: rewritten, model } = await smartComplete('anthropic', system, text, { maxTokens: 700 });
  res.json({ text: rewritten, model });
});

module.exports = {
  humanizeText,
  aiDetect,
  paraphrase,
  titleSuggestions,
  seoScore,
  rewriteInline,
};
