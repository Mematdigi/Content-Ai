const asyncHandler = require('express-async-handler');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
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

// Helper to extract JSON from text
function localExtractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
}

// @desc   Auto-suggest topic, target location, language, and audience description
// @route  POST /api/tools/auto-pick-topic
const autoPickTopic = asyncHandler(async (req, res) => {
  const system = `You are a creative content strategist. Generate a highly engaging, trending topic for an article.
Output ONLY a JSON object. No markdown tags, no notes, no preamble.
Format strictly as:
{
  "topic": "Suggested trending topic title",
  "targetLocation": "One of: India, United States, United Kingdom, Canada, Australia, Global",
  "language": "One of: English, Hindi, Spanish, French, German, Portuguese, Italian",
  "audience": "Brief target audience description tailored specifically to this topic and location (e.g. food enthusiasts looking for traditional dairy options in India)"
}`;

  const prompt = `Select a random trending topic in a popular vertical (e.g., tech, AI, productivity, business, health, cooking like buttermilk recipes, marketing, wellness).
Assign the most appropriate target audience location, article language, and a descriptive target audience. Make sure the audience description explicitly mentions the target location if relevant.`;

  try {
    const { text, model } = await smartComplete('openai', system, prompt, { maxTokens: 400 });
    const result = localExtractJson(text);
    if (result.topic && result.targetLocation && result.language && result.audience) {
      return res.json({ ...result, model });
    }
  } catch (err) {
    // fall through to mock fallback
  }

  // Fallback to a curated list of trending topics
  const topics = [
    {
      topic: "Exploring the Health Benefits of Buttermilk",
      targetLocation: "India",
      language: "English",
      audience: "Health-conscious individuals and traditional food lovers in India"
    },
    {
      topic: "Creative Recipes Using Buttermilk",
      targetLocation: "United States",
      language: "English",
      audience: "Home cooks and baking enthusiasts in the USA"
    },
    {
      topic: "The Future of Remote Work and Hybrid Teams",
      targetLocation: "Global",
      language: "English",
      audience: "HR managers, team leaders, and remote knowledge workers globally"
    },
    {
      topic: "How Artificial Intelligence is Changing Everyday Education",
      targetLocation: "United Kingdom",
      language: "English",
      audience: "Teachers, educational administrators, and students in the UK"
    },
    {
      topic: "A Beginner's Guide to Sustainable Kitchen Practices",
      targetLocation: "Canada",
      language: "English",
      audience: "Environmentally conscious citizens and home cooks in Canada"
    }
  ];

  const randomPick = topics[Math.floor(Math.random() * topics.length)];
  res.json({ ...randomPick, model: 'mock-fallback' });
});

// @desc   Extract text from uploaded files (PDF, DOCX, TXT)
// @route  POST /api/tools/extract-text
// @access Private
const extractTextFromFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }

  const { originalname, buffer } = req.file;
  const ext = originalname.split('.').pop().toLowerCase();

  let text = '';

  if (ext === 'txt' || ext === 'md' || ext === 'json') {
    text = buffer.toString('utf8');
  } else if (ext === 'pdf') {
    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      text = data.text || '';
      await parser.destroy();
    } catch (err) {
      res.status(400);
      throw new Error(`Failed to parse PDF file: ${err.message}`);
    }
  } else if (ext === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } catch (err) {
      res.status(400);
      throw new Error(`Failed to parse Word document: ${err.message}`);
    }
  } else {
    res.status(400);
    throw new Error(`Unsupported file format: .${ext}. Please upload a .txt, .pdf, or .docx file.`);
  }

  res.json({ text: text.trim() });
});

module.exports = {
  humanizeText,
  aiDetect,
  paraphrase,
  titleSuggestions,
  seoScore,
  rewriteInline,
  autoPickTopic,
  extractTextFromFile,
};

