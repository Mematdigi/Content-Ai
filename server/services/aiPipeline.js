/**
 * Multi-Model AI Pipeline
 * -----------------------
 *
 * Orchestrates content generation across multiple LLM providers. Each step
 * is independently swappable so you can route Step 2 to Claude, Step 3 to
 * Gemini, etc. — or fall back to the next available model if a provider is
 * unconfigured or fails.
 *
 *   Step 1 - Outline       -> OpenAI GPT-4o (preferred)
 *   Step 2 - Section write -> Anthropic Claude (preferred)
 *   Step 3 - SEO optimize  -> Google Gemini  (preferred)
 *   Step 4 - Humanize      -> Local engine (always) + Claude rewrite (if available)
 *   Step 5 - Quality check -> OpenAI (light pass)
 *
 * If none of the providers are configured the pipeline falls through to a
 * deterministic mock generator. This keeps the UI / dev loop usable without
 * needing paid API keys to evaluate the codebase.
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { humanize } = require('./humanizer');

// ---------- Lazy provider clients ----------------------------------------
let _openai;
function openai() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

let _anthropic;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

let _gemini;
function gemini() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) return null;
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  return _gemini;
}

// ---------- Provider-agnostic completion helpers --------------------------
async function completeOpenAI(system, prompt, { model = 'gpt-4o-mini', maxTokens = 2500 } = {}) {
  const client = openai();
  if (!client) throw new Error('OPENAI_API_KEY missing');
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content?.trim() || '';
}

async function completeClaude(system, prompt, { model = 'claude-sonnet-4-5', maxTokens = 2500 } = {}) {
  const client = anthropic();
  if (!client) throw new Error('ANTHROPIC_API_KEY missing');
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  // Anthropic responses are content blocks; concatenate text blocks.
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

async function completeGemini(system, prompt, { model = 'gemini-1.5-flash' } = {}) {
  const client = gemini();
  if (!client) throw new Error('GOOGLE_GEMINI_API_KEY missing');
  const m = client.getGenerativeModel({ model, systemInstruction: system });
  const result = await m.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Try the preferred provider, fall back through the others, and finally
 * fall back to a deterministic mock so the call always returns *something*.
 */
async function smartComplete(preferred, system, prompt, opts) {
  const order = ['openai', 'anthropic', 'gemini'].sort((a, b) =>
    a === preferred ? -1 : b === preferred ? 1 : 0
  );

  let lastErr;
  for (const provider of order) {
    try {
      if (provider === 'openai' && openai()) return { text: await completeOpenAI(system, prompt, opts), model: 'openai-gpt-4o-mini' };
      if (provider === 'anthropic' && anthropic()) return { text: await completeClaude(system, prompt, opts), model: 'anthropic-claude' };
      if (provider === 'gemini' && gemini()) return { text: await completeGemini(system, prompt, opts), model: 'google-gemini' };
    } catch (err) {
      lastErr = err;
      // try next provider
    }
  }

  // ---- Mock fallback so the dev loop is never blocked --------------------
  return { text: mockResponse(system, prompt), model: 'mock' };
}

// =========================================================================
// PIPELINE STEPS
// =========================================================================

async function generateOutline({ topic, brief, targetWordCount, headingsCount, articleType, tone }) {
  const system =
    'You are a senior content strategist producing detailed article outlines. Output ONLY the outline as a numbered markdown list. Do not include any commentary.';
  const prompt = `Create a detailed outline for a ${articleType} article on "${topic}".

Tone: ${tone}.
Target length: ~${targetWordCount} words.
Number of H2 headings: ${headingsCount}.

Use this research brief as grounding (extract structure, do not copy):
---
${brief}
---

Produce:
- 1 H1 (article title)
- ${headingsCount} H2s with 1-line summaries
- 2-3 H3s under each H2 where helpful
- Mark FAQ section if relevant

Format strictly as markdown with #, ##, ### prefixes.`;

  const t0 = Date.now();
  try {
    const { text, model } = await smartComplete('openai', system, prompt, { maxTokens: 1500 });
    return { outline: text, model, durationMs: Date.now() - t0, status: model === 'mock' ? 'fallback' : 'ok' };
  } catch (err) {
    return { outline: mockOutline(topic, headingsCount), model: 'mock', durationMs: Date.now() - t0, status: 'error' };
  }
}

async function writeContent({ outline, topic, brief, tone, audience, language, pointOfView, targetWordCount, primaryKeyword, secondaryKeywords }) {
  const system = `You are an expert ${tone} writer creating SEO-optimized, human-sounding articles in ${language}.
Write in ${pointOfView} person. Target audience: ${audience || 'general readers'}.
Vary sentence length. Use contractions. Avoid AI cliches like "delve", "in conclusion", "in today's fast-paced world".
Output clean markdown only.`;

  const prompt = `Write a complete article matching this outline:

${outline}

Topic: ${topic}
Primary keyword (use 3-5 times naturally): ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(', ')}
Target length: ${targetWordCount} words.

Use facts and structure from this research brief — paraphrase, never copy:
---
${brief}
---

Write the full article now in markdown.`;

  const t0 = Date.now();
  try {
    const { text, model } = await smartComplete('anthropic', system, prompt, { maxTokens: 4000 });
    return { content: text, model, durationMs: Date.now() - t0, status: model === 'mock' ? 'fallback' : 'ok' };
  } catch (err) {
    return { content: mockArticle(topic, outline, targetWordCount), model: 'mock', durationMs: Date.now() - t0, status: 'error' };
  }
}

async function optimizeForSEO({ content, primaryKeyword, secondaryKeywords, includeMeta }) {
  if (!includeMeta) {
    return { content, metaTitle: '', metaDescription: '', model: 'skipped', durationMs: 0, status: 'ok' };
  }

  const system = 'You are an SEO specialist. Output ONLY a JSON object with keys: metaTitle (50-60 chars), metaDescription (150-160 chars), refinedContent (markdown article with light keyword adjustments).';
  const prompt = `Article content:
---
${content}
---

Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(', ')}

Return JSON like:
{"metaTitle":"...","metaDescription":"...","refinedContent":"..."}`;

  const t0 = Date.now();
  try {
    const { text, model } = await smartComplete('gemini', system, prompt, { maxTokens: 4000 });
    const json = extractJson(text);
    return {
      content: json.refinedContent || content,
      metaTitle: json.metaTitle || '',
      metaDescription: json.metaDescription || '',
      model,
      durationMs: Date.now() - t0,
      status: model === 'mock' ? 'fallback' : 'ok',
    };
  } catch (err) {
    // Fall back to extracting first H1/first paragraph as meta
    const meta = extractFallbackMeta(content, primaryKeyword);
    return { content, ...meta, model: 'mock', durationMs: Date.now() - t0, status: 'fallback' };
  }
}

async function humanizePass(content) {
  const t0 = Date.now();
  // Always run the local humanizer first — it's fast, free, and effective.
  const local = humanize(content);

  // If a real LLM is available, do an additional rewrite pass with a
  // deliberately casual prompt for an extra layer of human texture.
  const llmAvailable = anthropic() || openai() || gemini();
  if (!llmAvailable) {
    return {
      content: local.text,
      aiScoreBefore: local.aiScoreBefore,
      aiScoreAfter: local.aiScoreAfter,
      model: 'local-humanizer',
      durationMs: Date.now() - t0,
      status: 'ok',
    };
  }

  const system = 'You are an experienced human blogger. Rewrite the given article so it sounds 100% human — like a real person writing on a Tuesday afternoon. Vary sentence length wildly. Use contractions, mild opinions, and natural transitions. Keep all facts, structure, and headings. Output markdown only.';
  const prompt = local.text;

  try {
    const { text, model } = await smartComplete('anthropic', system, prompt, { maxTokens: 4000 });
    // Re-score after the LLM rewrite
    const rescored = humanize(text);
    return {
      content: text,
      aiScoreBefore: local.aiScoreBefore,
      aiScoreAfter: rescored.aiScoreAfter,
      model,
      durationMs: Date.now() - t0,
      status: model === 'mock' ? 'fallback' : 'ok',
    };
  } catch (err) {
    return {
      content: local.text,
      aiScoreBefore: local.aiScoreBefore,
      aiScoreAfter: local.aiScoreAfter,
      model: 'local-humanizer',
      durationMs: Date.now() - t0,
      status: 'fallback',
    };
  }
}

// =========================================================================
// PUBLIC ORCHESTRATOR
// =========================================================================

async function runPipeline(input, onProgress = () => {}) {
  const steps = [];

  onProgress({ step: 'research', label: 'Gathering web sources...' });
  // (Research brief is fetched outside this function; passed in as input.brief)

  onProgress({ step: 'outline', label: 'Building article outline...' });
  const outline = await generateOutline(input);
  steps.push({ step: 'outline', model: outline.model, durationMs: outline.durationMs, status: outline.status });

  onProgress({ step: 'writing', label: 'Writing the article section by section...' });
  const written = await writeContent({ ...input, outline: outline.outline });
  steps.push({ step: 'writing', model: written.model, durationMs: written.durationMs, status: written.status });

  onProgress({ step: 'seo', label: 'Optimizing for SEO and meta tags...' });
  const optimized = await optimizeForSEO({
    content: written.content,
    primaryKeyword: input.primaryKeyword,
    secondaryKeywords: input.secondaryKeywords,
    includeMeta: input.includeMeta !== false,
  });
  steps.push({ step: 'seo', model: optimized.model, durationMs: optimized.durationMs, status: optimized.status });

  onProgress({ step: 'humanize', label: 'Humanizing for low AI-detection score...' });
  const humanized = await humanizePass(optimized.content);
  steps.push({ step: 'humanize', model: humanized.model, durationMs: humanized.durationMs, status: humanized.status });

  return {
    outline: outline.outline,
    content: humanized.content,
    metaTitle: optimized.metaTitle,
    metaDescription: optimized.metaDescription,
    aiScoreBefore: humanized.aiScoreBefore,
    aiScoreAfter: humanized.aiScoreAfter,
    pipelineSteps: steps,
  };
}

// =========================================================================
// HELPERS
// =========================================================================

function extractJson(text) {
  // LLMs sometimes wrap JSON in ```json fences or prepend explanatory text.
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

function extractFallbackMeta(content, primaryKeyword) {
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1] || primaryKeyword || 'Article';
  const firstPara = content.replace(/^#.*$/gm, '').trim().split(/\n\n+/)[0] || '';
  return {
    metaTitle: firstHeading.slice(0, 60),
    metaDescription: firstPara.replace(/\s+/g, ' ').slice(0, 160),
  };
}

// ---- Mock fallbacks ------------------------------------------------------
function mockOutline(topic, n = 5) {
  const heads = [];
  for (let i = 1; i <= n; i++) heads.push(`## ${i}. Key aspect of ${topic}\nA brief look at this dimension.`);
  return `# ${topic}: A complete guide\n\n${heads.join('\n\n')}\n\n## FAQ\n### Common questions about ${topic}`;
}

function mockArticle(topic, outline, targetWordCount = 1200) {
  const filler = `The world of ${topic} keeps shifting, and most readers are looking for plain answers without the fluff. In the sections below we break down what actually matters, what the data says, and where common advice gets it wrong.`;
  const sections = (outline.match(/^##\s+.+$/gm) || []).slice(0, 5).map((h) => {
    const title = h.replace(/^##\s+/, '');
    return `${h}\n\n${filler}\n\nHere is a deeper look at ${title.toLowerCase()}. There is no single right answer — context shapes the call. Some readers will find one approach faster, while others prefer something more methodical. Try a few, see what fits.\n`;
  });
  return [`# ${topic}: A practical guide`, '', filler, ...sections].join('\n');
}

function mockResponse(system, prompt) {
  if (/outline/i.test(system) || /outline/i.test(prompt)) {
    const topic = (prompt.match(/"([^"]+)"/) || [])[1] || 'this topic';
    return mockOutline(topic, 5);
  }
  if (/JSON/i.test(system)) {
    return '{"metaTitle":"A practical guide for modern readers","metaDescription":"Plain, useful guidance with examples and the occasional honest aside, written for people who actually want to learn.","refinedContent":""}';
  }
  return mockArticle('this topic', mockOutline('this topic'), 1200);
}

module.exports = {
  runPipeline,
  // exposed for the /tools endpoints
  generateOutline,
  optimizeForSEO,
  humanizePass,
  smartComplete,
};
