/**
 * SEO Scoring Engine
 * ------------------
 * Pure-function analysis of an article. Inputs: the rendered article text
 * (markdown or plain), the primary + secondary keywords, and the meta
 * fields. Output: a structured report with an overall 0-100 score.
 *
 * No network, no LLM — fast and deterministic, fine to run on every save.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'should', 'could', 'may', 'might', 'must', 'shall', 'can',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'into',
  'over', 'after', 'as', 'this', 'that', 'these', 'those', 'it', 'its',
  'i', 'you', 'he', 'she', 'we', 'they', 'them', 'us', 'me', 'him', 'her',
  'so', 'than', 'too', 'very', 'just', 'about', 'more', 'most', 'some',
  'any', 'all', 'no', 'not',
]);

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')         // fenced code
    .replace(/`[^`]*`/g, ' ')                 // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')// [text](url) and ![alt](url)
    .replace(/^#{1,6}\s+/gm, '')              // heading marks
    .replace(/[*_~>]/g, '')                   // formatting punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function getWords(text) {
  return stripMarkdown(text)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-z]/.test(w));
}

function getSentences(text) {
  return stripMarkdown(text)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countSyllables(word) {
  // Simple, fast estimator; not perfect but standard for FK readability.
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

/**
 * Flesch Reading Ease: higher = easier to read. 60-70 is the sweet spot for
 * blog content.
 */
function fleschReadingEase(text) {
  const words = getWords(text);
  const sentences = getSentences(text);
  if (!words.length || !sentences.length) return 0;
  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Keyword density as a percentage. Returns "Phrase counter" — handles
 * multi-word keywords by sliding-window match instead of word-by-word.
 */
function keywordDensity(text, keyword) {
  if (!keyword) return { count: 0, density: 0 };
  const stripped = stripMarkdown(text).toLowerCase();
  const kw = keyword.toLowerCase().trim();
  if (!kw) return { count: 0, density: 0 };

  const words = stripped.split(/\s+/).filter(Boolean);
  let count = 0;
  if (kw.includes(' ')) {
    // multi-word phrase
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    count = (stripped.match(re) || []).length;
  } else {
    count = words.filter((w) => w.replace(/[^a-z0-9]/g, '') === kw).length;
  }
  const density = words.length ? +(count / words.length * 100).toFixed(2) : 0;
  return { count, density };
}

/**
 * Heading structure validator. Checks H1 uniqueness and that we don't skip
 * levels (H2 -> H4 with no H3 in between).
 */
function checkHeadings(markdown) {
  const issues = [];
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let m;
  while ((m = regex.exec(markdown))) {
    headings.push({ level: m[1].length, text: m[2].trim() });
  }

  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) issues.push('No H1 found');
  if (h1s.length > 1) issues.push(`${h1s.length} H1s found — should be exactly 1`);

  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      issues.push(`Skipped heading level: H${headings[i - 1].level} → H${headings[i].level}`);
    }
  }

  return { valid: issues.length === 0, issues, totalHeadings: headings.length };
}

/**
 * Suggest LSI / semantically-related keywords by frequency. Filters
 * stopwords and the user's own primary/secondary keywords.
 */
function suggestLsiKeywords(text, primary, secondary = []) {
  const banned = new Set(
    [primary, ...secondary]
      .filter(Boolean)
      .flatMap((k) => k.toLowerCase().split(/\s+/))
  );
  const counts = new Map();
  getWords(text).forEach((w) => {
    if (STOPWORDS.has(w) || banned.has(w) || w.length < 4) return;
    counts.set(w, (counts.get(w) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * Main scorer. Combines sub-checks into a single 0-100 number.
 */
function scoreArticle({ content, title, metaTitle, metaDescription, primaryKeyword, secondaryKeywords = [], targetWordCount }) {
  const words = getWords(content);
  const wordCount = words.length;

  const primary = keywordDensity(content, primaryKeyword);
  const secondary = secondaryKeywords.map((k) => ({ keyword: k, ...keywordDensity(content, k) }));
  const readability = fleschReadingEase(content);
  const headingStructure = checkHeadings(content);
  const lsi = suggestLsiKeywords(content, primaryKeyword, secondaryKeywords);

  const metaTitleStr = metaTitle || title || '';
  const metaTitleOk = metaTitleStr.length >= 50 && metaTitleStr.length <= 60;
  const metaDescOk = metaDescription
    ? metaDescription.length >= 150 && metaDescription.length <= 160
    : false;

  // ---- Score breakdown (each component capped) -------------------------
  let score = 0;
  const parts = [];

  // Word count vs target (max 15)
  if (targetWordCount && wordCount) {
    const ratio = wordCount / targetWordCount;
    const wcPart = ratio >= 0.85 && ratio <= 1.25 ? 15 : ratio >= 0.6 ? 10 : 4;
    score += wcPart;
    parts.push(`word count (${wordCount}/${targetWordCount}): +${wcPart}`);
  } else {
    score += 10;
  }

  // Primary keyword density 0.5%-2.5% is healthy (max 25)
  let kwPart = 0;
  if (primary.density >= 0.5 && primary.density <= 2.5) kwPart = 25;
  else if (primary.density > 0 && primary.density < 0.5) kwPart = 12;
  else if (primary.density > 2.5 && primary.density <= 4) kwPart = 10;
  else kwPart = 0;
  score += kwPart;
  parts.push(`primary keyword density (${primary.density}%): +${kwPart}`);

  // Readability (max 15)
  let readPart = 0;
  if (readability >= 60 && readability <= 80) readPart = 15;
  else if (readability >= 40) readPart = 10;
  else readPart = 5;
  score += readPart;
  parts.push(`readability (${readability}): +${readPart}`);

  // Heading structure (max 15)
  const hPart = headingStructure.valid ? 15 : Math.max(5, 15 - headingStructure.issues.length * 4);
  score += hPart;
  parts.push(`heading structure: +${hPart}`);

  // Meta title (max 10)
  const mtPart = metaTitleOk ? 10 : metaTitleStr ? 5 : 0;
  score += mtPart;
  parts.push(`meta title (${metaTitleStr.length} chars): +${mtPart}`);

  // Meta description (max 10)
  const mdPart = metaDescOk ? 10 : metaDescription ? 5 : 0;
  score += mdPart;
  parts.push(`meta description (${(metaDescription || '').length} chars): +${mdPart}`);

  // Secondary keyword usage (max 10)
  const usedSecondary = secondary.filter((s) => s.count > 0).length;
  const sPart = secondaryKeywords.length
    ? Math.round((usedSecondary / secondaryKeywords.length) * 10)
    : 5;
  score += sPart;
  parts.push(`secondary keywords used (${usedSecondary}/${secondaryKeywords.length || 0}): +${sPart}`);

  return {
    overall: Math.min(100, Math.round(score)),
    breakdown: parts,
    keywordDensity: { primary, secondary },
    readability,
    headingStructure,
    metaTitle: { value: metaTitleStr, length: metaTitleStr.length, ok: metaTitleOk },
    metaDescription: {
      value: metaDescription || '',
      length: (metaDescription || '').length,
      ok: metaDescOk,
    },
    lsiKeywords: lsi,
    wordCount,
    suggestions: buildSuggestions({
      primary, secondary, readability, headingStructure, metaTitleOk, metaDescOk, lsi,
    }),
  };
}

function buildSuggestions({ primary, secondary, readability, headingStructure, metaTitleOk, metaDescOk, lsi }) {
  const out = [];
  if (primary.density === 0) out.push('Primary keyword does not appear in the article — add it 3–5 times naturally.');
  if (primary.density > 3) out.push('Primary keyword density is too high — reduce repetition to avoid keyword stuffing.');
  if (readability < 50) out.push('Readability is low — shorten sentences and pick simpler words.');
  if (!headingStructure.valid) out.push(`Fix heading structure: ${headingStructure.issues.join('; ')}.`);
  if (!metaTitleOk) out.push('Meta title should be 50–60 characters.');
  if (!metaDescOk) out.push('Meta description should be 150–160 characters.');
  const unusedSecondary = secondary.filter((s) => s.count === 0).map((s) => s.keyword);
  if (unusedSecondary.length) out.push(`Mention these secondary keywords at least once: ${unusedSecondary.join(', ')}.`);
  if (lsi.length) out.push(`Consider weaving in related terms: ${lsi.slice(0, 5).join(', ')}.`);
  return out;
}

module.exports = { scoreArticle, fleschReadingEase, keywordDensity, checkHeadings };
