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

  const seen = new Set();
  for (const h of headings) {
    const normalized = h.text.toLowerCase().replace(/^[0-9.\s]+/, '').trim();
    if (seen.has(normalized)) {
      issues.push(`Duplicate heading found: "${h.text}"`);
    }
    seen.add(normalized);
  }

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
function checkSnippetReadiness(content) {
  const lines = content.split(/\r?\n/);
  let questionHeadingsCount = 0;
  let matchingDirectAnswersCount = 0;
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(##|###)\s+(.+)$/.test(line)) {
      const headingText = line.replace(/^(##|###)\s+/, '').toLowerCase();
      if (/\b(what|how|why|who|where|define|difference|vs)\b/i.test(headingText)) {
        questionHeadingsCount++;
        let nextPara = '';
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j].trim();
          if (l === '') continue;
          if (/^(#|##|###)/.test(l)) break;
          nextPara = l;
          break;
        }
        if (nextPara) {
          const cleanPara = nextPara.replace(/[#*`_>]/g, '').trim();
          const words = cleanPara.split(/\s+/).filter(Boolean);
          if (words.length >= 35 && words.length <= 65) {
            matchingDirectAnswersCount++;
          } else {
            issues.push(`Snippet optimization: Paragraph under question heading "${line.replace(/^(##|###)\s+/, '')}" should be 35-65 words (currently ${words.length} words).`);
          }
        } else {
          issues.push(`Snippet optimization: Missing answer paragraph under question heading "${line.replace(/^(##|###)\s+/, '')}".`);
        }
      }
    }
  }

  const score = questionHeadingsCount > 0
    ? Math.round((matchingDirectAnswersCount / questionHeadingsCount) * 15)
    : 10; // 10 points default if no question headings exist

  return { score, issues, hasSnippetHeadings: questionHeadingsCount > 0 };
}

function checkKeywordInIntro(content, primaryKeyword) {
  if (!primaryKeyword) return false;
  const stripped = stripMarkdown(content);
  const first100 = stripped.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  return first100.includes(primaryKeyword.toLowerCase());
}

function checkKeywordInHeadings(content, primaryKeyword) {
  if (!primaryKeyword) return { h2Count: 0, h3Count: 0, h2WithKw: 0, h3WithKw: 0 };
  const kw = primaryKeyword.toLowerCase();
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let m;
  while ((m = regex.exec(content))) {
    headings.push({ level: m[1].length, text: m[2].trim() });
  }
  const h2s = headings.filter(h => h.level === 2);
  const h3s = headings.filter(h => h.level === 3);
  return {
    h2Count: h2s.length,
    h3Count: h3s.length,
    h2WithKw: h2s.filter(h => h.text.toLowerCase().includes(kw)).length,
    h3WithKw: h3s.filter(h => h.text.toLowerCase().includes(kw)).length,
  };
}

function checkSchemaInContent(content) {
  const match = content.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return { ok: false, value: '' };
  try {
    JSON.parse(match[1]);
    return { ok: true, value: match[1].trim() };
  } catch {
    return { ok: false, value: match[1] || '' };
  }
}

function checkFaqSection(content) {
  const faqHeading = /^#{1,3}\s+.*FAQ/im.test(content);
  if (!faqHeading) return { hasFaq: false, count: 0, answersTooLong: [] };
  const faqMatch = content.match(/^#{1,3}\s+.*FAQ[\s\S]*/im);
  if (!faqMatch) return { hasFaq: false, count: 0, answersTooLong: [] };
  const faqSection = faqMatch[0];
  const questions = faqSection.match(/^#{1,4}\s+.+\?/gm) ||
                    faqSection.match(/\*\*[^*]+\?\*\*/g) || [];

  const lines = faqSection.split('\n');
  const answersTooLong = [];
  let currentQuestion = null;
  let currentAnswerWords = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const lowerLine = line.toLowerCase();
    if (line.startsWith('#') && !line.includes('FAQ')) {
      // Heading of next section (e.g. ## Sources and References or ## Conclusion)
      break;
    }
    if (lowerLine.startsWith('sources') || lowerLine.startsWith('about the') || lowerLine.startsWith('conclusion') || lowerLine.startsWith('wrapping up')) {
      break;
    }

    const isNumbered = /^\d+\.\s+/.test(line);
    const isBoldQuestion = /^\*\*(.*?)\*\*/.test(line) && line.includes('?');
    const isRawQuestion = line.endsWith('?') && line.length < 150;

    if (isNumbered || isBoldQuestion || isRawQuestion) {
      if (currentQuestion && currentAnswerWords > 30) {
        answersTooLong.push({ question: currentQuestion, wordCount: currentAnswerWords });
      }
      currentQuestion = line;
      currentAnswerWords = 0;
    } else if (currentQuestion) {
      const cleanLine = line.replace(/[#*`_>]/g, '').trim();
      if (cleanLine) {
        currentAnswerWords += cleanLine.split(/\s+/).filter(Boolean).length;
      }
    }
  }

  if (currentQuestion && currentAnswerWords > 30) {
    answersTooLong.push({ question: currentQuestion, wordCount: currentAnswerWords });
  }

  return { hasFaq: true, count: questions.length, answersTooLong };
}

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

  // New checks
  const kwInIntro = checkKeywordInIntro(content, primaryKeyword);
  const kwInHeadings = checkKeywordInHeadings(content, primaryKeyword);
  const snippet = checkSnippetReadiness(content);
  const schema = checkSchemaInContent(content);
  const faq = checkFaqSection(content);

  // ---- Score breakdown (100 points total) -------------------------
  let score = 0;
  const parts = [];

  // 1. Word count vs target (max 10)
  if (targetWordCount && wordCount) {
    const ratio = wordCount / targetWordCount;
    const wcPart = ratio >= 0.85 && ratio <= 1.25 ? 10 : ratio >= 0.6 ? 6 : 3;
    score += wcPart;
    parts.push(`word count (${wordCount}/${targetWordCount}): +${wcPart}`);
  } else {
    score += 6;
    parts.push(`word count: +6`);
  }

  // 2. Primary keyword density 0.5%-2.5% (max 15)
  let kwPart = 0;
  if (primary.density >= 0.5 && primary.density <= 2.5) kwPart = 15;
  else if (primary.density > 0 && primary.density < 0.5) kwPart = 8;
  else if (primary.density > 2.5 && primary.density <= 4) kwPart = 5;
  else kwPart = 0;
  score += kwPart;
  parts.push(`primary keyword density (${primary.density}%): +${kwPart}`);

  // 3. Keyword in first 100 words (max 5)
  const introPart = kwInIntro ? 5 : 0;
  score += introPart;
  parts.push(`keyword in intro: +${introPart}`);

  // 4. Keyword in H2/H3 headings (max 10)
  let hKwPart = 0;
  if (kwInHeadings.h2WithKw >= 2) hKwPart += 5;
  else if (kwInHeadings.h2WithKw >= 1) hKwPart += 3;
  if (kwInHeadings.h3WithKw >= 1) hKwPart += 5;
  else if (kwInHeadings.h3Count >= 1) hKwPart += 2;
  score += hKwPart;
  parts.push(`keyword in headings (${kwInHeadings.h2WithKw} H2s, ${kwInHeadings.h3WithKw} H3s): +${hKwPart}`);

  // 5. Readability (max 10)
  let readPart = 0;
  if (readability >= 60 && readability <= 80) readPart = 10;
  else if (readability >= 40) readPart = 7;
  else readPart = 3;
  score += readPart;
  parts.push(`readability (Flesch ${readability}): +${readPart}`);

  // 6. Heading structure — proper H1/H2/H3 hierarchy (max 10)
  const hPart = headingStructure.valid ? 10 : Math.max(3, 10 - headingStructure.issues.length * 3);
  score += hPart;
  parts.push(`heading structure: +${hPart}`);

  // 7. Meta title 50-60 chars (max 5)
  const mtPart = metaTitleOk ? 5 : metaTitleStr ? 2 : 0;
  score += mtPart;
  parts.push(`meta title (${metaTitleStr.length} chars): +${mtPart}`);

  // 8. Meta description 150-160 chars (max 5)
  const mdPart = metaDescOk ? 5 : metaDescription ? 2 : 0;
  score += mdPart;
  parts.push(`meta description (${(metaDescription || '').length} chars): +${mdPart}`);

  // 9. Secondary keywords used (max 5)
  const usedSecondary = secondary.filter((s) => s.count > 0).length;
  const sPart = secondaryKeywords.length
    ? Math.round((usedSecondary / secondaryKeywords.length) * 5)
    : 3;
  score += sPart;
  parts.push(`secondary keywords (${usedSecondary}/${secondaryKeywords.length || 0}): +${sPart}`);

  // 10. Featured snippet readiness (max 10)
  const snippetPart = Math.min(10, snippet.score);
  score += snippetPart;
  parts.push(`featured snippet readiness: +${snippetPart}`);

  // 11. FAQ section with 5+ questions (max 5)
  let faqPart = 0;
  if (faq.hasFaq && faq.count === 5) faqPart = 5;
  else if (faq.hasFaq && (faq.count === 4 || faq.count === 6)) faqPart = 3;
  else if (faq.hasFaq) faqPart = 1;
  
  if (faq.answersTooLong && faq.answersTooLong.length > 0) {
    faqPart = Math.max(0, faqPart - 2); // deduct 2 points if any answers are too long
  }
  score += faqPart;
  parts.push(`FAQ section (${faq.count} questions, ${faq.answersTooLong ? faq.answersTooLong.length : 0} too long): +${faqPart}`);

  // 12. JSON-LD schema markup embedded in content (max 10)
  const schemaPart = schema.ok ? 10 : 0;
  score += schemaPart;
  parts.push(`JSON-LD schema: +${schemaPart}`);

  return {
    overall: Math.min(100, Math.round(score)),
    breakdown: parts,
    keywordDensity: { primary, secondary },
    readability,
    headingStructure,
    kwInIntro,
    kwInHeadings,
    metaTitle: { value: metaTitleStr, length: metaTitleStr.length, ok: metaTitleOk },
    metaDescription: {
      value: metaDescription || '',
      length: (metaDescription || '').length,
      ok: metaDescOk,
    },
    schemaMarkup: schema,
    faq,
    lsiKeywords: lsi,
    wordCount,
    suggestions: buildSuggestions({
      primary, secondary, readability, headingStructure, metaTitleOk, metaDescOk, lsi, snippet, faq, kwInIntro, kwInHeadings, schemaOk: schema.ok
    }),
  };
}

function buildSuggestions({ primary, secondary, readability, headingStructure, metaTitleOk, metaDescOk, lsi, snippet, faq, kwInIntro, kwInHeadings, schemaOk }) {
  const out = [];

  // Keyword checks
  if (primary.density === 0) out.push('Primary keyword does not appear in the article — add it 3–5 times naturally.');
  else if (primary.density < 0.5) out.push('Primary keyword density is below 0.5% — add a few more natural mentions.');
  if (primary.density > 3) out.push('Primary keyword density is too high — reduce repetition to avoid keyword stuffing.');
  if (kwInIntro === false) out.push('E-E-A-T: Primary keyword missing from the first 100 words — add it to the introduction.');
  if (kwInHeadings && kwInHeadings.h2WithKw < 2) out.push('SEO: Include the primary keyword in at least 2 H2 headings.');
  if (kwInHeadings && kwInHeadings.h3WithKw < 1) out.push('SEO: Include the primary keyword in at least 1 H3 heading.');

  // Readability
  if (readability < 50) out.push('Readability is low — shorten sentences and use simpler words.');

  // Structure
  if (!headingStructure.valid) out.push(`Fix heading structure: ${headingStructure.issues.join('; ')}.`);
  if (!metaTitleOk) out.push('Meta title should be 50–60 characters.');
  if (!metaDescOk) out.push('Meta description should be 150–160 characters.');

  // FAQ
  if (!faq || !faq.hasFaq) out.push('E-E-A-T: Add a FAQ section with exactly 5 questions to target People Also Ask results.');
  else {
    if (faq.count !== 5) out.push(`FAQ section has ${faq.count} questions — it should be exactly 5 questions for Featured Snippets.`);
    if (faq.answersTooLong && faq.answersTooLong.length > 0) {
      out.push(`FAQ: Keep answers strictly under 20-30 words (currently has answer of ${faq.answersTooLong[0].wordCount} words).`);
    }
  }

  // Snippet readiness
  if (snippet && snippet.issues && snippet.issues.length > 0) {
    out.push(...snippet.issues);
  }
  if (snippet && !snippet.hasSnippetHeadings) {
    out.push('Featured Snippet: Use question-format headings (e.g. "What is [topic]?") with 35-65 word answers directly below.');
  }

  // Schema
  if (!schemaOk) {
    out.push('Schema: Add JSON-LD structured data (Article + FAQPage) for Google rich results and carousels.');
  }

  // Secondary keywords
  const unusedSecondary = secondary.filter((s) => s.count === 0).map((s) => s.keyword);
  if (unusedSecondary.length) out.push(`Mention these secondary keywords at least once: ${unusedSecondary.join(', ')}.`);
  if (lsi.length) out.push(`LSI: Weave in related terms: ${lsi.slice(0, 5).join(', ')}.`);
  return out;
}

module.exports = { scoreArticle, fleschReadingEase, keywordDensity, checkHeadings };
