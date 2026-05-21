/**
 * Humanizer Engine
 * ----------------
 * A deterministic, dependency-free pass that runs *before* (or alongside) any
 * LLM-based rewrite. It does the boring-but-effective stuff:
 *
 *   1. Replaces telltale AI phrases ("delve into", "in conclusion", ...) with
 *      natural alternatives.
 *   2. Re-introduces contractions (do not -> don't) about half the time so it
 *      doesn't read like a wire-service press release.
 *   3. Sprinkles human-sounding transitions ("Honestly,", "Here's the thing,")
 *      at the start of selected paragraphs.
 *   4. Re-paragraphs into uneven blocks — AI text tends to ship in tidy 3-4
 *      sentence paragraphs. Human writing varies.
 *   5. Provides a rough heuristic AI-score before/after so the UI can show a
 *      delta when no real detector API key is configured.
 *
 * The expensive LLM-rewrite pass lives in aiPipeline.js; this file is the
 * cheap, always-on baseline.
 */

const AI_PHRASE_REPLACEMENTS = [
  [/\bdelve into\b/gi, 'dig into'],
  [/\bdelving into\b/gi, 'digging into'],
  [/\bin conclusion\b/gi, 'so'],
  [/\bin summary\b/gi, 'to wrap up'],
  [/\bit's worth noting that\b/gi, 'worth knowing:'],
  [/\bit is worth noting\b/gi, 'one thing to know'],
  [/\bin today's (fast-paced |digital |modern )?world\b/gi, 'these days'],
  [/\bnavigating the\b/gi, 'figuring out the'],
  [/\bunlock the (full )?potential\b/gi, 'get the most out'],
  [/\bharness the power of\b/gi, 'put'],
  [/\ba testament to\b/gi, 'a sign of'],
  [/\bplay a (crucial|vital|key|pivotal) role in\b/gi, 'matter for'],
  [/\bat the forefront of\b/gi, 'leading on'],
  [/\bgame[- ]changer\b/gi, 'a real shift'],
  [/\bcutting-edge\b/gi, 'modern'],
  [/\bstate-of-the-art\b/gi, 'high-end'],
  [/\bseamlessly\b/gi, 'easily'],
  [/\bplethora of\b/gi, 'plenty of'],
  [/\bmyriad of\b/gi, 'lots of'],
  [/\bembark on (a |the )?journey\b/gi, 'get started'],
  [/\bin the realm of\b/gi, 'in'],
  [/\bfurthermore,?\b/gi, 'also,'],
  [/\bmoreover,?\b/gi, 'and'],
  [/\bnotwithstanding,?\b/gi, 'still,'],
];

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
];

const HUMAN_OPENERS = [
  "Honestly, ",
  "Here's the thing — ",
  "Look, ",
  "Quick aside: ",
  "Real talk: ",
  "What's interesting is that ",
  "One thing people miss: ",
];

// Deterministic PRNG so the output is stable for the same input - useful for
// tests and for showing consistent diff metrics in the UI.
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
        // Preserve initial capitalization of the original match.
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

function reparagraph(text, rand) {
  // Split into sentences using a conservative regex (Mr., Dr., etc still
  // imperfect but good enough for blog content).
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const paragraphs = [];
  let i = 0;
  while (i < sentences.length) {
    // Random paragraph length 1..5 sentences (uneven blocks)
    const len = 1 + Math.floor(rand() * 5);
    paragraphs.push(sentences.slice(i, i + len).join(' '));
    i += len;
  }
  return paragraphs;
}

function injectOpeners(paragraphs, rand) {
  // Add a human opener to ~25% of paragraphs (skipping the first).
  return paragraphs.map((p, idx) => {
    if (idx === 0) return p;
    if (rand() < 0.25) {
      const opener = HUMAN_OPENERS[Math.floor(rand() * HUMAN_OPENERS.length)];
      // Lowercase the original first letter unless it's an acronym/proper noun.
      const first = p.split(/\s+/)[0] || '';
      const isAcronym = /^[A-Z]{2,}/.test(first);
      const rest = isAcronym ? p : p.charAt(0).toLowerCase() + p.slice(1);
      return opener + rest;
    }
    return p;
  });
}

/**
 * Heuristic AI-likeness score in [0, 100]. Not a substitute for a real
 * detector — but it correlates with the textual fingerprints our humanizer
 * specifically targets, which is exactly what we want it to.
 */
function estimateAiScore(text) {
  const t = text.toLowerCase();
  let score = 30; // baseline

  const aiSignals = [
    'delve into', 'in conclusion', "it's worth noting", 'unlock the',
    'harness the power', 'in today\'s fast-paced', 'navigating the',
    'plethora of', 'myriad of', 'cutting-edge', 'state-of-the-art',
    'embark on a journey', 'a testament to', 'play a crucial role',
    'in the realm of', 'furthermore', 'moreover',
  ];

  aiSignals.forEach((phrase) => {
    const matches = t.split(phrase).length - 1;
    score += matches * 6;
  });

  // Sentence-length variance — AI tends to be uniform.
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length > 4) {
    const lens = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    if (variance < 25) score += 15; // very uniform = AI smell
  }

  // Contraction density — AI text under-uses them.
  const contractionMatches = (text.match(/\b\w+'\w+\b/g) || []).length;
  const contractionRate = contractionMatches / Math.max(sentences.length, 1);
  if (contractionRate < 0.1) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Main humanize entry point.
 */
function humanize(rawText) {
  const rand = mulberry32(hashSeed(rawText.slice(0, 200)));
  const aiScoreBefore = estimateAiScore(rawText);

  // 1. Phrase replacements — always on.
  let text = applyReplacements(rawText, AI_PHRASE_REPLACEMENTS, rand, 1);

  // 2. Contractions — apply to ~60% of matches so it doesn't sound like a teen.
  text = applyReplacements(text, CONTRACTIONS, rand, 0.6);

  // 3. Re-paragraph + 4. inject openers.
  const paragraphs = reparagraph(text, rand);
  const withOpeners = injectOpeners(paragraphs, rand);

  const finalText = withOpeners.join('\n\n');
  const aiScoreAfter = estimateAiScore(finalText);

  return {
    text: finalText,
    aiScoreBefore,
    aiScoreAfter,
  };
}

module.exports = { humanize, estimateAiScore };
