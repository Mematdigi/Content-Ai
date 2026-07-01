/**
 * Humanizer Engine — SEO-Safe Edition
 * ------------------------------------
 * This local pass handles ONLY things that are safe to do with regex:
 *
 *   1. Contractions (do not → don't) — zero SEO impact, big AI detection impact
 *   2. Multi-word AI filler phrases that are NEVER real search keywords
 *      (e.g., "it goes without saying", "in today's fast-paced world")
 *   3. AI-score estimation (heuristic, for the UI delta display)
 *
 * What this file does NOT do (and why):
 *   - No single-word replacements (e.g., "optimize" → "improve")
 *     because those words can be real SEO keywords in many niches.
 *   - No paragraph restructuring — the LLM humanizer handles this
 *     contextually, preserving the flow the writer intended.
 *   - No injected openers ("Honestly,", "Look,") — these sound fake
 *     when inserted randomly. The LLM adds them naturally where they fit.
 *
 * The heavy humanization work is done by the LLM rewrite pass in
 * aiPipeline.js, which understands context and won't break keywords.
 */

// --- Multi-word AI filler phrases only ---
// Rule: every pattern here must be 3+ words or a phrase that is
// NEVER a real search query. If someone might Google it, don't touch it.
const AI_PHRASE_REPLACEMENTS = [
  [/\bdelve into\b/gi, 'look at'],
  [/\bdelving into\b/gi, 'looking at'],
  [/\bin conclusion,?\b/gi, 'so'],
  [/\bin summary,?\b/gi, 'to wrap up'],
  [/\bit's worth noting that\b/gi, 'worth knowing:'],
  [/\bit is worth noting\b/gi, 'one thing to know —'],
  [/\bin today's (fast-paced |digital |modern )?world\b/gi, 'these days'],
  [/\bunlock the (full )?potential\b/gi, 'get the most out'],
  [/\bharness the power of\b/gi, 'use'],
  [/\ba testament to\b/gi, 'a sign of'],
  [/\bplay a (crucial|vital|key|pivotal) role in\b/gi, 'matter for'],
  [/\bat the forefront of\b/gi, 'leading'],
  [/\bplethora of\b/gi, 'plenty of'],
  [/\bmyriad of\b/gi, 'lots of'],
  [/\bembark on (a |the )?journey\b/gi, 'get started'],
  [/\bin the realm of\b/gi, 'in'],
  [/\bfurthermore,?\b/gi, 'also,'],
  [/\bmoreover,?\b/gi, 'and'],
  [/\bfirst and foremost\b/gi, 'first,'],
  [/\bparadigm shift\b/gi, 'big change'],
  [/\btapestry of\b/gi, 'mix of'],
  [/\bbeacon of\b/gi, 'sign of'],
  [/\bit goes without saying\b/gi, ''],
  [/\bneedless to say,?\b/gi, ''],
  [/\bit is crucial to (note|understand|remember) that\b/gi, ''],
  [/\bit is essential to (note|understand|remember) that\b/gi, ''],
  [/\bit is important to (note|understand|remember) that\b/gi, ''],
  [/\bthis guide will help you\b/gi, "here you'll"],
  [/\bserves as a comprehensive\b/gi, 'works as a'],
  [/\bequips you with the insights needed\b/gi, 'gives you what you need'],
  [/\benhance your grasp of\b/gi, 'help you understand'],
  [/\bremains a cornerstone of\b/gi, 'is a big part of'],
  [/\bshaping the (economic |digital |modern )?landscape\b/gi, 'affecting the economy'],
  [/\bpresent exciting opportunities\b/gi, 'open up new chances'],
  [/\brobust economic environment\b/gi, 'strong economy'],
  [/\bremarkable resilience\b/gi, 'strong staying power'],
  [/\bwith that being said,?\b/gi, 'that said,'],
  [/\bin light of (this|that|these)\b/gi, 'given $1'],
  // --- Flagged repetitive AI-detector phrases ---
  [/\blet's be real\b/gi, 'honestly'],
  [/\bdon't sleep on\b/gi, "don't overlook"],
  [/\bmakes sense, right\?\b/gi, ''],
  [/\bfair warning:?\b/gi, 'just keep in mind'],
  // --- "In this article" meta-commentary patterns ---
  [/\bin this article,?\s*(you'll|you will|we will|we'll|we)\s*(explore|learn|discover|find|discuss|cover|examine|look at|dive into|break down)[^.]*\.\s*/gi, ''],
  [/\bin this (guide|post|piece|blog),?\s*(you'll|you will|we will|we'll|we)\s*(explore|learn|discover|find|discuss|cover|examine)[^.]*\.\s*/gi, ''],
  [/\bthis article (explores|covers|discusses|examines|breaks down)[^.]*\.\s*/gi, ''],
  [/\bit's (essential|important|crucial) to (discuss|understand|note|recognize|acknowledge)\b/gi, ''],
  [/\blet's (explore|examine|take a look at|dive into|break down)\b/gi, ''],
  [/\bunderstanding these changes can help you\b/gi, ''],
  [/\bas we (navigate|adapt to) this\b/gi, 'with this'],
  [/\bthe (ever-evolving|ever-changing)\b/gi, 'the changing'],
  [/\bpoised to\b/gi, 'set to'],
  [/\bgear up for\b/gi, 'prepare for'],
  [/\bthe interplay between\b/gi, 'how'],
  [/\bmultifaceted\b/gi, 'complex'],
  [/\bgame[- ]changing\b/gi, 'major'],
];

// Contractions — always SEO-safe, biggest single AI detection signal
const CONTRACTIONS = [
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
  [/\bcannot\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhad not\b/g, "hadn't"],
  [/\byou are\b/g, "you're"],
  [/\bthey are\b/g, "they're"],
  [/\bit is\b/g, "it's"],
  [/\bthat is\b/g, "that's"],
  [/\bI am\b/g, "I'm"],
  [/\bwe are\b/g, "we're"],
  [/\bwho is\b/g, "who's"],
  [/\bwhat is\b/g, "what's"],
  [/\bthere is\b/g, "there's"],
  [/\bhere is\b/g, "here's"],
];

// --- Sentence starters to break AI-typical paragraph openings ---
const SENTENCE_STARTERS = [
  'Look, ', 'Here\'s the thing — ', 'But ', 'And ', 'Honestly, ',
  'The thing is, ', 'Now, ', 'So ', 'Still, ', 'That said, ',
  'Worth knowing — ',
];

// --- Parenthetical asides for natural human texture ---
const PARENTHETICAL_ASIDES = [
  ' (seriously)', ' (yes, really)', ' (not always)', ' (surprisingly)',
  ' (no joke)', ' (trust me)', ' (and yes, it matters)',
  ' (which helps)', ' (more on that below)',
];

// --- Rhetorical questions to break monotone explanatory flow ---
const RHETORICAL_QUESTIONS = [
  'Why does this matter?', 'Sound familiar?',
  'What does this mean in practice?', 'So what\'s the takeaway?',
  'See the pattern?', 'The catch?',
  'Why should you care?',
];

// --- AI-style heading patterns → conversational headings ---
const HEADING_TRANSFORMS = [
  [/^(#{2,3})\s+(?:Key |Core |Main |Essential )?Benefits (?:of|for) (.+)$/i, '$1 Why $2 Actually Matters'],
  [/^(#{2,3})\s+(?:The )?Importance of (.+)$/i, '$1 Why $2 Matters'],
  [/^(#{2,3})\s+Understanding (.+)$/i, '$1 What Is $2?'],
  [/^(#{2,3})\s+(?:An )?(?:Introduction|Overview) (?:to|of) (.+)$/i, '$1 What Is $2?'],
  [/^(#{2,3})\s+(?:Key |Major |Common )?Challenges (?:of |in |with |for )?(.+?)(?:\s+and How to (?:Overcome|Address|Fix|Solve) Them)?$/i, '$1 What Makes $2 Hard?'],
  [/^(#{2,3})\s+(?:Best Practices|Tips|Strategies) (?:for|and|to) (.+)$/i, '$1 What Actually Works for $2'],
  [/^(#{2,3})\s+(?:Future |Emerging )?Trends (?:and (?:Developments|Predictions) )?(?:in|of|for) (.+)$/i, '$1 Where Is $2 Heading?'],
];

// Deterministic PRNG for stable output
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function applyReplacements(text, pairs, rand, probability = 1) {
  let out = text;
  for (const [pattern, replacement] of pairs) {
    out = out.replace(pattern, (match) => {
      if (probability >= 1 || rand() < probability) {
        const isCap = /^[A-Z]/.test(match);
        return isCap
          ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
          : replacement;
      }
      return match;
    });
  }
  return out;
}

// --- Sentence starters: prepend casual openers to ~12% of paragraphs ---
function applySentenceStarters(text, rand) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return text;

  const first = sentences[0];
  const alreadyCasual = SENTENCE_STARTERS.some((s) =>
    first.toLowerCase().startsWith(s.trim().toLowerCase())
  );

  if (!alreadyCasual && rand() < 0.12) {
    const starter = SENTENCE_STARTERS[Math.floor(rand() * SENTENCE_STARTERS.length)];
    const safeToLower = ['the', 'a', 'an', 'it', 'this', 'that', 'these', 'those',
      'there', 'i', 'we', 'you', 'they', 'he', 'she', 'when', 'if', 'while',
      'as', 'in', 'on', 'for', 'with', 'by', 'from', 'most', 'many', 'some',
      'all', 'each', 'every'];
    const firstWord = first.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (safeToLower.includes(firstWord)) {
      sentences[0] = starter + first.charAt(0).toLowerCase() + first.slice(1);
    } else {
      sentences[0] = starter + first;
    }
  }

  return sentences.join(' ');
}

// --- Inject parenthetical asides into ~5% of long sentences ---
function injectParentheticals(text, rand) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result = [];

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 12 && rand() < 0.05) {
      const searchStart = Math.floor(sentence.length * 0.3);
      const commaIdx = sentence.indexOf(', ', searchStart);
      if (commaIdx > -1) {
        const aside = PARENTHETICAL_ASIDES[Math.floor(rand() * PARENTHETICAL_ASIDES.length)];
        result.push(
          sentence.slice(0, commaIdx + 1) + aside + sentence.slice(commaIdx + 1)
        );
        continue;
      }
    }
    result.push(sentence);
  }

  return result.join(' ');
}

// --- Append a rhetorical question to ~8% of paragraphs ---
function maybeAddRhetoricalQuestion(text, rand) {
  if (rand() < 0.08) {
    const q = RHETORICAL_QUESTIONS[Math.floor(rand() * RHETORICAL_QUESTIONS.length)];
    return text.trimEnd() + ' ' + q;
  }
  return text;
}

// --- Transform AI-style headings into conversational form ---
function humanizeHeading(line, rand) {
  for (const [pattern, replacement] of HEADING_TRANSFORMS) {
    if (pattern.test(line) && rand() < 0.7) {
      return line.replace(pattern, replacement);
    }
  }
  return line;
}

// --- Sentence burstiness: split long sentences, merge short ones ---
function applySentenceBurstiness(text, rand) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 3) return text;

  const result = [];
  let i = 0;

  while (i < sentences.length) {
    const current = sentences[i];
    const words = current.split(/\s+/).length;

    if (words > 22 && rand() < 0.15) {
      const splitPoints = [', and ', ', but ', ', because ', ', so '];
      let didSplit = false;
      for (const sp of splitPoints) {
        const idx = current.indexOf(sp);
        if (idx > current.length * 0.3 && idx < current.length * 0.8) {
          const firstPart = current.slice(0, idx) + '.';
          const rest = current.slice(idx + sp.length).trim();
          const secondPart = rest.charAt(0).toUpperCase() + rest.slice(1);
          result.push(firstPart, secondPart);
          didSplit = true;
          break;
        }
      }
      if (!didSplit) result.push(current);
    } else if (
      words < 7 &&
      i + 1 < sentences.length &&
      sentences[i + 1].split(/\s+/).length < 7 &&
      rand() < 0.2
    ) {
      const next = sentences[i + 1];
      const merged =
        current.replace(/[.!?]$/, '') +
        ' — ' +
        next.charAt(0).toLowerCase() +
        next.slice(1);
      result.push(merged);
      i += 2;
      continue;
    } else {
      result.push(current);
    }
    i++;
  }

  return result.join(' ');
}

/**
 * Heuristic AI-likeness score [0, 100].
 * Checks three signals that AI detection tools look for:
 *   1. Known AI filler phrases
 *   2. Uniform sentence length (low variance)
 *   3. Missing contractions
 */
function estimateAiScore(text) {
  const t = text.toLowerCase();
  let score = 30; // baseline — all text starts with some AI suspicion

  // Signal 1: AI filler phrases
  const aiSignals = [
    'delve into', 'in conclusion', "it's worth noting", 'unlock the',
    'harness the power', 'in today\'s fast-paced', 'in today\'s world',
    'plethora of', 'myriad of', 'embark on a journey', 'a testament to',
    'play a crucial role', 'in the realm of', 'furthermore', 'moreover',
    'it goes without saying', 'needless to say', 'it is crucial to note',
    'it is important to note', 'it is essential to', 'paradigm shift',
    'serves as a comprehensive', 'remains a cornerstone', 'has emerged as',
    'remarkable resilience', 'equips you with', 'enhance your grasp',
    'this guide will help you', 'shaping the landscape',
  ];

  aiSignals.forEach((phrase) => {
    const count = t.split(phrase).length - 1;
    score += count * 6;
  });

  // Signal 2: Sentence-length uniformity
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length > 4) {
    const lens = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    if (variance < 15) score += 20;      // very uniform = strong AI signal
    else if (variance < 30) score += 10;  // somewhat uniform
  }

  // Signal 3: Contraction density — humans use contractions ~20-40% of the time
  const contractionMatches = (text.match(/\b\w+'\w+\b/g) || []).length;
  const contractionRate = contractionMatches / Math.max(sentences.length, 1);
  if (contractionRate < 0.05) score += 15;      // almost no contractions = strong AI signal
  else if (contractionRate < 0.15) score += 8;   // low contractions

  // Signal 4: Paragraph opening word diversity
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim() && !p.trim().startsWith('#'));
  if (paragraphs.length >= 4) {
    const openers = paragraphs.map((p) => p.trim().split(/\s+/)[0]?.toLowerCase());
    const uniqueOpeners = new Set(openers);
    const diversity = uniqueOpeners.size / openers.length;
    if (diversity < 0.4) score += 15;
    else if (diversity < 0.6) score += 8;
  }

  // Signal 5: Formal transition word density
  const formalTransitions = (
    t.match(
      /\b(furthermore|moreover|additionally|consequently|nevertheless|subsequently|henceforth|whereby|wherein|thereof)\b/g
    ) || []
  ).length;
  score += Math.min(formalTransitions * 5, 20);

  // Signal 6: Average word length — AI uses longer, fancier words
  const allWords = text.match(/\b[a-zA-Z]+\b/g) || [];
  if (allWords.length > 50) {
    const avgLen = allWords.reduce((sum, w) => sum + w.length, 0) / allWords.length;
    if (avgLen > 5.5) score += 10;
    else if (avgLen > 5.0) score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Main humanize entry point.
 * Only does SEO-safe operations:
 *   1. Replace multi-word AI filler phrases
 *   2. Add contractions (~70% probability)
 * Does NOT restructure paragraphs or inject openers — the LLM handles that.
 */
function humanize(rawText, niche = 'general') {
  const rand = mulberry32(hashSeed(rawText.slice(0, 200)));
  const aiScoreBefore = estimateAiScore(rawText);

  const blocks = rawText.split(/\n\n+/);
  const processedBlocks = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const isHeading = trimmed.startsWith('#');
    const isTable = trimmed.startsWith('|') || trimmed.includes('\n|');
    const isHtmlOrScript = trimmed.startsWith('<');
    const isBlockquote = trimmed.startsWith('>');
    const isImagePlaceholder = trimmed.startsWith('<!--');
    const isList = /^\s*[-*\d+.]/.test(trimmed);

    if (isTable || isHtmlOrScript || isBlockquote || isImagePlaceholder) {
      processedBlocks.push(trimmed);
    } else if (isHeading) {
      processedBlocks.push(humanizeHeading(trimmed, rand));
    } else if (isList) {
      let text = applyReplacements(trimmed, AI_PHRASE_REPLACEMENTS, rand, 1);
      text = applyReplacements(text, CONTRACTIONS, rand, 0.7);
      processedBlocks.push(text);
    } else {
      let text = applyReplacements(trimmed, AI_PHRASE_REPLACEMENTS, rand, 1);
      text = applyReplacements(text, CONTRACTIONS, rand, 0.7);
      text = applySentenceBurstiness(text, rand);
      text = applySentenceStarters(text, rand);
      text = injectParentheticals(text, rand);
      text = maybeAddRhetoricalQuestion(text, rand);
      processedBlocks.push(text);
    }
  }

  const finalText = processedBlocks.join('\n\n');
  const aiScoreAfter = estimateAiScore(finalText);

  return {
    text: finalText,
    aiScoreBefore,
    aiScoreAfter,
  };
}

/**
 * Post-LLM validation pass.
 * Re-runs phrase/contraction cleanup on LLM output to catch patterns
 * the rewrite model re-introduced. Does NOT add starters, asides, or
 * rhetorical questions — those were already applied in the first pass
 * and the LLM should have preserved the natural texture.
 */
function postLlmValidation(text, niche = 'general') {
  const rand = mulberry32(hashSeed(text.slice(0, 200) + 'post'));

  const blocks = text.split(/\n\n+/);
  const processedBlocks = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const isTable = trimmed.startsWith('|') || trimmed.includes('\n|');
    const isHtmlOrScript = trimmed.startsWith('<');
    const isBlockquote = trimmed.startsWith('>');
    const isImagePlaceholder = trimmed.startsWith('<!--');

    if (isTable || isHtmlOrScript || isBlockquote || isImagePlaceholder) {
      processedBlocks.push(trimmed);
    } else {
      let out = applyReplacements(trimmed, AI_PHRASE_REPLACEMENTS, rand, 1);
      out = applyReplacements(out, CONTRACTIONS, rand, 0.7);
      processedBlocks.push(out);
    }
  }

  return processedBlocks.join('\n\n');
}

module.exports = { humanize, estimateAiScore, postLlmValidation };
