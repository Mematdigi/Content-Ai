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

const { humanize, postLlmValidation } = require('./humanizer');

// ---------- Niche Classifier Helper ----------------------------------------
function classifyNiche(topic = '', primaryKeyword = '') {
  const text = `${topic} ${primaryKeyword}`.toLowerCase();
  
  // Sports indicators
  const sportsKeywords = [
    'vs', 'match', 'cup', 'league', 'stadium', 'football', 'soccer', 'cricket', 'basketball',
    'nba', 'nfl', 'player', 'lineup', 'prediction', 'win', 'watch', 'live', 'kickoff',
    'betting', 'odds', 'premier league', 'la liga', 'world cup', 'euros', 'copa america', 'champions league'
  ];
  
  // Finance/payments indicators
  const financeKeywords = [
    'payment', 'bank', 'remittance', 'money', 'wise', 'paypal', 'stripe', 'fee', 'firc', 'fira',
    'rbi', 'fema', 'inward', 'outward', 'compliance', 'transfer', 'lrs', 'gst', 'upi'
  ];

  if (sportsKeywords.some(kw => text.includes(kw))) {
    return 'sports';
  }
  if (financeKeywords.some(kw => text.includes(kw))) {
    return 'finance';
  }
  return 'general';
}

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

  // Fallback to local mock content generator if no provider succeeds or none is configured
  console.warn(`[smartComplete] AI completion unavailable. Falling back to local mock generator. Details: ${lastErr ? lastErr.message : 'No API keys configured'}`);
  return { text: mockResponse(system, prompt), model: 'mock' };
}

// =========================================================================
// PIPELINE STEPS
// =========================================================================

async function generateOutline({ topic, brief, targetWordCount, headingsCount, articleType, tone, primaryKeyword, isHypothetical, insufficientData, authorName }) {
  const niche = classifyNiche(topic, primaryKeyword);

  const textNormalized = `${topic} ${primaryKeyword || ''}`.toLowerCase();
  const isMatchup = textNormalized.includes('vs') || textNormalized.includes('clash') || textNormalized.includes('against') || textNormalized.includes('meet') || textNormalized.includes('play');

  let nicheRequirements = '';
  if (niche === 'sports') {
    if (isMatchup) {
      nicheRequirements = `
- At least 3 H2 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match. One H2 must cover the match preview/kickoff details. ${isHypothetical ? 'MANDATORY: Since this is a hypothetical/projected match (not officially scheduled yet), this heading must be framed as a "Potential Matchup Preview" or "Projected Clash Preview", rather than a confirmed kickoff details heading.' : 'One H2 must cover the match preview/kickoff details.'} Another H2 must focus on head-to-head history and stats.
- At least 2 H3 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match. Focus on subtopics like predicted lineups or tactical key matchups.
- Under at least one H2, include a structured comparison table comparing team stats (such as FIFA rankings or other verified metrics from the research brief). Do NOT include unverified stats like World Cup titles or head-to-head records if they are not explicitly present in the research brief.
- Under at least one H2, include a custom visual comparison chart in HTML format (using <div class="custom-chart"> wrapper) comparing team metrics (such as win probability or recent form) ONLY if they are verified in the research brief.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous sports figure or analyst related to the matchup.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs targeting search queries related to the match. Do NOT invent answers to FAQs if the facts are not verified in the brief; write "Information not yet officially confirmed" for any unverified answers.`;
    } else {
      nicheRequirements = `
- If the Research Brief does not contain actual factual details about group standings, schedules, or team news for the requested topic, you MUST limit the outline to exactly two H2 headings: '1. Tournament Schedule and Status' and '2. FAQ'. Do NOT include headings for lineups, standings, tactics, or predictions if they are unverified.
- If the Research Brief does contain verified tournament/team facts, you may include:
  - At least 3 H2 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match. Focus on tournament status, group standings, schedules, or general team news as present in the research brief. Do NOT assume or invent specific matchups if none are verified in the brief.
  - At least 2 H3 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match. Focus on specific subtopics like key player updates, injury news, or tactical strategies from the research brief.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous sports figure or expert related to the topic.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs directly related to the topic "${topic}" and the primary keyword "${primaryKeyword}". Do NOT invent answers; write "Information not yet officially confirmed" if the facts are not in the brief.`;
    }
  } else if (niche === 'finance') {
    nicheRequirements = `
- At least 3 H2 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match. Dedicate at least two H2 headings specifically as questions targeting high-intent search queries.
- At least 2 H3 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match.
- Under at least one H2, include a structured comparison table comparing platforms or requirements based on facts in the research brief.
- Under at least one H2, include a custom visual bar chart in HTML format (using <div class="custom-chart"> wrapper) comparing platforms, costs, or speeds.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous finance expert, economist, or industry leader.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs based on real-world search queries.`;
  } else {
    nicheRequirements = `
- At least 3 H2 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match.
- At least 2 H3 headings: Each MUST incorporate the primary keyword "${primaryKeyword}" in exact match.
- If the Research Brief contains specific numerical data or metrics, include a structured comparison table under one H2. If no verified numbers exist in the brief, use a qualitative comparison or skip the table entirely. NEVER plan a table with invented statistics.
- Only include a custom visual bar chart (using <div class="custom-chart"> wrapper) if the Research Brief contains verified numerical comparisons. Do NOT plan a chart if you would need to invent the numbers.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous person or authority figure related to "${topic}".
- Plan 2-3 image placement points spread across the article (after intro, mid-article, near conclusion).
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs directly related to the topic "${topic}" and the primary keyword "${primaryKeyword}".`;
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const system =
    'You are a senior content strategist producing detailed article outlines designed for Google Featured Snippets and carousels. Output ONLY the outline as a numbered markdown list. Do not include any commentary.';
  const prompt = `Create a detailed outline for a ${articleType} article on "${topic}".

Today's Date: ${currentDateStr} (Anchor relative terms like "tomorrow", "yesterday", or "next week" to this date).
Primary Keyword: "${primaryKeyword}".
Tone: ${tone}.
Target length: ~${targetWordCount} words (preferably 1000 - 1100 words for optimal skyscraper formatting).

MANDATORY outline layout sections that MUST be planned:
- Title (H1 at the top)
- Introduction (60-120 words written directly below the Title, explaining the topic briefly. Do NOT include a "## Introduction" heading).
- H2 sections (with H3 where appropriate)
- FAQ (exactly 5-6 question-answer slots)
- Conclusion

MANDATORY outline requirements:
- Only one H1 on the page (the title at the very top).
- The introduction text (60-120 words explaining the topic briefly and clearly) must start immediately below the H1 Title. Do NOT create or include a "## Introduction" heading.
- At least 3 content-carrying H2 headings (excluding FAQ and Conclusion). Each of these 3 content-carrying H2 headings MUST incorporate the primary keyword "${primaryKeyword}" in exact match.
- At least 2 content-carrying H3 headings. Each of these 2 content-carrying H3 headings MUST incorporate the primary keyword "${primaryKeyword}" (or the main topic subject keyword "${primaryKeyword.split(' ').pop()}") naturally.
- A bullet list under at least one heading.
- Plan a slot for one related quote from a famous/expert person.
- A related comparison table based on facts in the brief.
- Plan 2-3 image placement points spread across the article.
- A dedicated FAQ section at the very end with exactly 5-6 distinct question-answer pairs directly related to the topic "${topic}" and the primary keyword "${primaryKeyword}".
${nicheRequirements}
- Do NOT include an "About the Author" section.
- Do NOT include a "Sources and References" section.
${insufficientData ? `- CRITICAL DATA WARNING: The Research Brief flagged INSUFFICIENT DATA for this time-sensitive query. Do NOT create outline headings that assume specific fixtures, match schedules, scores, or event details exist. Instead, limit the outline to: (1) a heading acknowledging that verified data is unavailable for the requested date, (2) general background if available, and (3) FAQ. Do NOT include headings for lineups, predictions, or match previews when no verified match data exists.` : ''}

Research Brief Grounding (You must strictly base all outline headings, subheadings, comparison tables, and FAQ questions on these factual web references. Do NOT assume, invent, or hallucinate dates, locations, details, or timelines outside of these references. If any required table or comparison metric is not present in the Research Brief, do NOT include it in the outline headings or tables):
---
${brief}
---

Format strictly as markdown with #, ##, ### prefixes.`;

  const t0 = Date.now();
  const { text, model } = await smartComplete('openai', system, prompt, { maxTokens: 1500 });
  return { outline: text, model, durationMs: Date.now() - t0, status: 'ok' };
}

function parseOutline(outline) {
  const lines = outline.split('\n');
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        isIntro: false,
        heading: line.replace('## ', '').trim(),
        rawHeading: line,
        content: [line],
      };
    } else {
      if (!currentSection) {
        currentSection = {
          isIntro: true,
          heading: 'Introduction',
          rawHeading: '# Introduction',
          content: [line],
        };
      } else {
        currentSection.content.push(line);
      }
    }
  }
  if (currentSection) {
    sections.push(currentSection);
  }
  return sections;
}

async function writeContent({ outline, topic, brief, tone, audience, language, pointOfView, targetWordCount, primaryKeyword, secondaryKeywords, authorName, isHypothetical, insufficientData, contentMode, onProgress }) {
  const niche = classifyNiche(topic, primaryKeyword);

  let snippetIntroRule = '';
  let styleRules = '';
  let chartRule = '';
  let authorRule = '';
  let accuracyRules = '';
  let predictionRule = '';

  const textNormalized = `${topic} ${primaryKeyword || ''}`.toLowerCase();
  const isMatchup = textNormalized.includes('vs') || textNormalized.includes('clash') || textNormalized.includes('against') || textNormalized.includes('meet') || textNormalized.includes('play');

  if (niche === 'sports') {
    if (isMatchup) {
      snippetIntroRule = `Start the very first paragraph directly with a professional, clear, snippet-friendly match summary. If the match is confirmed/scheduled in the research brief, summarize the kickoff details (date, time, venue). If the match is hypothetical or not officially scheduled (such as a potential knockout stage meeting like Brazil vs Germany), explicitly frame it as a projected, potential, or hypothetical future matchup (e.g. "A potential World Cup 2026 clash between Brazil and Germany would be one of the most anticipated matchups..."). Keep the introduction under 120 words.`;
      
      styleRules = `Write as an expert sports journalist and analyst (similar to writing for The Athletic or ESPN). Avoid cheesy AI language and conversational filler like "Circle your calendars!", "Let's break down...", "Here's the truth...", "Think of it this way...", "Hey there!", "Don't worry!", "Let's dive in", "Let's jump in", "First things first", or "In this post...".
Instead, write with authority and sharp football intelligence, focusing on contrasting team tactics (e.g. one team's possession-based midfield challenging the other's defensive structure).`;

      chartRule = `If win probabilities are NOT verified in the research brief, do NOT construct the win probability custom-chart. Instead, construct a comparison table/chart comparing other verified metrics from the brief, or omit the custom-chart block entirely. If win probabilities are verified in the brief, construct a beautiful, responsive visual comparison chart comparing match stats or win probability using this exact HTML structure within the text:
       <div class="custom-chart">
         <h4 class="custom-chart__title">Win Probability / Head-to-Head Prediction (%)</h4>
         <div class="chart-bar-row">
           <div class="chart-label">[Team A] Win</div>
           <div class="chart-bar-container">
             <div class="chart-bar bg-success" style="width: [Percentage]%;">[Percentage]%</div>
           </div>
         </div>
         <div class="chart-bar-row">
           <div class="chart-label">Draw</div>
           <div class="chart-bar-container">
             <div class="chart-bar bg-warning" style="width: [Percentage]%;">[Percentage]%</div>
           </div>
         </div>
         <div class="chart-bar-row">
           <div class="chart-label">[Team B] Win</div>
           <div class="chart-bar-container">
             <div class="chart-bar bg-danger" style="style: [Percentage]%;">[Percentage]%</div>
           </div>
         </div>
       </div>
      - MANDATORY: You must write the actual raw HTML code block directly into the article body. Substitute the placeholders [Team A], [Team B], and [Percentage] with actual competing teams and predicted percentages from the research brief or statistics. Do NOT write placeholders like "Insert Chart Here" or "Custom Visual Bar Chart" in plain text. Do NOT wrap the HTML code block in markdown code fences (like \`\`\`html or \`\`\`) because the frontend parser needs raw HTML lines to render the chart dynamically.`;

      authorRule = authorName
        ? `End the article with a brief "About the Author" section. Write ONLY: "${authorName} is a content writer." — nothing more. Do NOT invent job titles, expertise areas, years of experience, educational background, previous employers, or professional credentials. One sentence only.`
        : `Do NOT include an "About the Author" section at all. Skip it entirely.`;

      accuracyRules = `- STRICT SOURCE GROUNDING: You must ONLY use factual information found in the provided research brief. Do NOT assume, invent, or guess details. If any specific detail (such as kickoff time, venue, lineups, injuries, FIFA rankings, or statistics) is not present in the research brief, you MUST write "Information not yet officially confirmed." instead of inventing it. Never guess.
- Win Probability Calculations: If you include win probabilities (e.g., in a comparison chart or text), they MUST sum to exactly 100% (e.g., Team A win 45%, Draw 25%, Team B win 30%). Verify this math.
- World Cup Titles & Stats: Do NOT invent World Cup titles or other major stats (e.g., Portugal has NEVER won the World Cup). Check facts against the research brief. If not mentioned in the brief, do not state it as a fact.
- Timezone accuracy: For matches in June (e.g., in Miami or other US locations), use daylight saving time labels (like EDT, CDT, PDT) rather than standard time labels (like EST, CST, PST).
- Realistic Lineups: Do not guess starting lineups or assume aging stars (e.g., Cristiano Ronaldo starting at age 41 in 2026, or Duván Zapata) will start without explicit confirmation in the sources. If not mentioned, state that official squads and lineups are not yet confirmed.
- Hypothetical Matchups: You must verify if the match is officially scheduled in the research brief. If the references state that the match is not scheduled (e.g. "do not have any future meetings scheduled right now") or if a confirmed date/time is missing, you MUST frame the entire article (including the introduction, preview, and headings) as a hypothetical, projected, or potential future matchup (using words like "potential", "projected", "would", "if they advance"). You are strictly forbidden from writing as if the match is officially confirmed.
- Venue & Date for Hypothetical Matches: For hypothetical matchups, any mention of a potential date (e.g., June 27, 2026) or venue (e.g., NRG Stadium in Houston) must be explicitly presented as a projected tournament slot where the match could take place if both teams qualify and advance, rather than a confirmed fixture.
- Host Nations & Venues: The FIFA World Cup 2026 is hosted exclusively by the United States, Canada, and Mexico. Never place a 2026 World Cup match in a non-host country (such as Brazil's Maracanã). A country like Brazil cannot have "home ground advantage" in the 2026 World Cup.
- FIFA Rankings: Always state the rankings as "the latest official FIFA rankings" or include their context/date. Do not state old or incorrect rankings. If not mentioned in the brief, state that they are not confirmed.
- Head-to-Head and History: Do not invent fictional friendly scores (such as a 2022 friendly score) or fictional stats. Ground historical details strictly in the verified search snippets.`;

      predictionRule = `- The prediction and tactical analysis sections must be substantial, deep, and detailed.
- Provide a clear breakdown of each team's tactical profile based on facts in the research brief, focusing on defensive organization, midfield control, high pressing, and counter-attacks.
- Provide a reasoned, detailed prediction based on these tactical dynamics.`;
    } else {
      snippetIntroRule = `Start the very first paragraph directly with a professional, clear, snippet-friendly summary of the tournament status, general schedules, group standings, or team news described in the Research Brief. Keep the introduction under 120 words.`;
      
      styleRules = `Write as an expert sports journalist and analyst (similar to writing for The Athletic or ESPN). Avoid cheesy AI language and conversational filler. Write with authority, focusing on verified player updates, team news, group standings, or tournament schedules.`;

      chartRule = `Do NOT output any win probability chart or predicted matchup visual blocks, since this is a general sports update and not a specific match between two teams.`;

      authorRule = authorName
        ? `End the article with a brief "About the Author" section. Write ONLY: "${authorName} is a content writer." — nothing more. Do NOT invent job titles, expertise areas, years of experience, educational background, previous employers, or professional credentials. One sentence only.`
        : `Do NOT include an "About the Author" section at all. Skip it entirely.`;

      accuracyRules = `- STRICT SOURCE GROUNDING: You must ONLY use factual information found in the provided research brief. Do NOT assume, invent, or guess details. If any specific detail (such as group schedules, standings, squads, or rankings) is not present in the research brief, you MUST write "Information not yet officially confirmed." instead of inventing it. Never guess.
- NO HALLUCINATED MATCHES OR KICKOFFS: If the Research Brief does not contain an active, confirmed schedule for the requested date (tomorrow, June 27, 2026), you MUST explicitly state that there is no confirmed schedule for this date and sport. You are strictly forbidden from inventing hypothetical kickoff times (such as "3 PM local time") or matches.
- SPORT & TOURNAMENT CLARITY: Be extremely precise about the sport and specific tournament. For example, if the user asks generally about "Women's World Cup" matches in June 2026, and the research brief is about the "Women's T20 World Cup" (which is Cricket, hosted in England in June-July 2026), clarify that this is Cricket, and that the next FIFA Women's World Cup (Association Football/Soccer) is not until 2027 in Brazil. Do NOT mix up Cricket and Association Football, and do NOT invent fictional soccer matches for 2026.
- FIFA/ICC Rankings and standings must be grounded strictly in the brief. If not present, do not invent them.
- NEVER INVENT NUMBERS: Do NOT create statistics, percentages, or measurements for tables or charts unless those exact numbers appear in the research brief.`;

      predictionRule = '';
    }
  } else if (niche === 'finance') {
    snippetIntroRule = `Start the very first paragraph directly with a professional, clear, snippet-friendly statement of the problem and the answer (e.g., "International payments in India can be received through bank transfers, Wise, PayPal, Stripe, and other payment platforms. The right method depends on fees, settlement time, and business requirements."). Keep the introduction under 120 words.`;
    
    styleRules = `Write like a financial advisor and friend explaining it simply. Use natural contractions ("don't", "it's", "you'll") and direct, action-oriented verbs.
Use bold lead-ins for key points (e.g., "**Here is the truth:**", "**The best part?**", "**Why does this matter?**").
Use friendly transitions to guide the reader: "Look:", "But that's not all...", "Here's how to get started:", "The catch?", "Think about it like this...".`;
 
    chartRule = `Construct a beautiful, responsive visual comparison chart comparing metrics (e.g. fees, settlement times) using this exact HTML structure within the text:
     <div class="custom-chart">
       <h4 class="custom-chart__title">Comparison of Platform Fees (%)</h4>
       <div class="chart-bar-row">
         <div class="chart-label">Wise</div>
         <div class="chart-bar-container">
           <div class="chart-bar bg-success" style="width: 25%;">0.5% - 0.7%</div>
         </div>
       </div>
       <div class="chart-bar-row">
         <div class="chart-label">Payoneer</div>
         <div class="chart-bar-container">
           <div class="chart-bar bg-warning" style="width: 50%;">2.0%</div>
         </div>
       </div>
       <div class="chart-bar-row">
         <div class="chart-label">PayPal</div>
         <div class="chart-bar-container">
           <div class="chart-bar bg-danger" style="width: 90%;">4.4%</div>
         </div>
       </div>
     </div>
    - MANDATORY: You must write the actual raw HTML code block directly into the article body. Do NOT write placeholders like "Insert Chart Here" or "Custom Visual Bar Chart" in plain text. Do NOT wrap the HTML code block in markdown code fences (like \`\`\`html or \`\`\`) because the frontend parser needs raw HTML lines to render the chart dynamically.`;

    authorRule = authorName
      ? `End the article with a brief "About the Author" section. Write ONLY: "${authorName} is a content writer." — nothing more. Do NOT invent job titles, expertise areas, years of experience, educational background, previous employers, or professional credentials. One sentence only.`
      : `Do NOT include an "About the Author" section at all. Skip it entirely.`;

    accuracyRules = `- STRICT SOURCE GROUNDING: You must ONLY use factual information found in the provided research brief. Do NOT assume, invent, or guess details. If any specific detail is not present in the research brief, you MUST write "Information not yet officially confirmed." instead of inventing it. Never guess.
- Ground all statistics, numbers, dates, years, timelines, and facts strictly in the provided research brief and scraped references. Do NOT invent, guess, or hallucinate dates, years, timelines, or metrics. If the date of an event, policy release, or milestone is not explicitly mentioned in the research brief, refer to it generally or state that the timeline is unconfirmed rather than making up a date.
- UPI: Do NOT state that UPI is domestic-only. Fact: UPI now supports international transactions in partnering countries (such as Singapore, UAE, France, Mauritius, Sri Lanka, Nepal, and for NRI accounts).
- Inward Remittance Limits: Do NOT state there is a "$250,000 per financial year limit without approvals" for receiving/inward payments. The LRS limit of $250,000 applies strictly to OUTWARD remittances (sending money abroad from India). For inward remittances, limits depend on the bank/gateway and purpose codes, with no fixed $250k general ceiling.
- Platform Fees: Never state fees as absolute fixed percentages without adding context. Explicitly mention that fee structures fluctuate and vary based on country, currency, transfer method (e.g., credit card vs. local ACH), and transaction size.
- Ground your facts in high-authority regulatory and official finance sources (such as RBI guidelines, FEMA regulations, and official Stripe/PayPal/Wise pricing and documentation). Do not use generic news blogs or encyclopedias like Wikipedia.
- NEVER INVENT NUMBERS: Do NOT create statistics, percentages, or fee comparisons for tables or charts unless those exact numbers appear in the research brief.`;

    predictionRule = '';
  } else {
    snippetIntroRule = `Start the very first paragraph directly with a professional, clear, snippet-friendly definition or explanation of the topic immediately. Avoid generic greetings. Keep the introduction under 120 words.`;

    styleRules = `Write as an expert in the field. Avoid cheesy AI language and conversational filler like "Circle your calendars!", "Let's break down...", "Here's the truth...", "Think of it this way...", "Hey there!", "Don't worry!", "Let's dive in", "Let's jump in", "First things first", or "In this post...".
Keep paragraphs short (1–3 sentences max) to make scanning effortless.`;

    chartRule = `Only include a comparison chart if the research brief contains real, specific numbers or metrics to compare. If the brief has verified data, construct a responsive visual chart using this HTML structure:
     <div class="custom-chart">
       <h4 class="custom-chart__title">Comparison Title</h4>
       <div class="chart-bar-row">
         <div class="chart-label">Item Name</div>
         <div class="chart-bar-container">
           <div class="chart-bar bg-success" style="width: 80%;">Value</div>
         </div>
       </div>
     </div>
    - MANDATORY: Every number, percentage, and metric in the chart MUST come from the research brief. Do NOT invent statistics, percentages, measurements, or comparison values. If you cannot fill a chart with verified data from the brief, do NOT include any chart at all.
    - Do NOT wrap the HTML in markdown code fences.`;

    authorRule = authorName
      ? `End the article with a brief "About the Author" section. Write ONLY: "${authorName} is a content writer." — nothing more. Do NOT invent job titles, expertise areas, years of experience, educational background, previous employers, or professional credentials. One sentence only.`
      : `Do NOT include an "About the Author" section at all. Skip it entirely.`;

    accuracyRules = contentMode === 'knowledge'
      ? `- STRICT SOURCE GROUNDING: Base all claims on the provided research brief. For well-established scientific or educational topics, you may explain widely accepted concepts (e.g., "CO₂ is a greenhouse gas") without a specific source citation, but do NOT invent specific statistics, percentages, measurements, or numerical comparisons.
- NEVER INVENT NUMBERS: This is a critical rule. Do NOT create, estimate, or approximate ANY statistics, percentages, growth rates, temperatures, measurements, year-by-year data, or numerical comparisons unless those EXACT numbers appear word-for-word in the research brief sources. This includes:
  * Do NOT create year-over-year data tables (e.g., "2021: 6.2%, 2022: 7.0%") unless those exact figures are in the sources.
  * Do NOT estimate or round numbers that are not in the brief.
  * Do NOT create "before vs after" numerical comparisons unless sourced.
  * If you want to show a comparison, use qualitative terms (e.g., "High / Medium / Low", "Increased / Decreased / Stable") instead of fabricating percentages or measurements.
  * If a table would require invented numbers, do NOT include the table at all.
- SOURCES SECTION: End the article with a "Sources and References" section listing the actual sources from the research brief (by title and domain). Do NOT write "Information not yet officially confirmed" — this is an evergreen knowledge topic, not a live news event. If specific sources were used, list them. If the topic is based on widely accepted knowledge, reference authoritative bodies (e.g., IPCC, NASA, WHO, peer-reviewed research).
- Do NOT apply news-style validation phrases like "not yet confirmed" or "officially announced" to established scientific or educational facts.`
      : `- STRICT SOURCE GROUNDING: You must ONLY use factual information found in the provided research brief. Do NOT assume, invent, or guess details. If any specific detail is not present in the research brief, you MUST write "Information not yet officially confirmed." instead of inventing it. Never guess.
- Ground all statistics, numbers, dates, years, timelines, and facts strictly in the provided research brief and scraped references. Do NOT invent, guess, or hallucinate dates, years, timelines, or metrics.`;

    predictionRule = '';
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const system = `You write highly engaging, human-like articles. Study and follow the writing style of this premium lifestyle blog article: https://flypped.com/lifestyle/benefits-of-buttermilk

VOICE & TONE (this is the #1 priority):
- Warm, direct, natural, and human tone. Explain things clearly and simply as a human author would.
- Do NOT use typical AI introductory/transition fillers.
- Use simple words and phrases. Avoid complex jargon or unnatural, flowery language.
- Use synonyms and semantic/related keywords naturally throughout the text instead of repeating the same keyword mechanically.
- Use natural contractions always: "don't", "isn't", "won't", "it's", "here's", "that's".

Target audience: ${audience || 'readers looking for clear, friendly, and practical help'}.
Write in ${pointOfView || 'second'} person.
Today's Date: ${currentDateStr}.

ARTICLE TEMPLATE:

1. TITLE (H1):
   - Only one H1 (the title) at the very top of the page.

1.2 ESTIMATED READING TIME:
   - Below the H1 title, add "Estimated Reading Time: X minutes" (e.g. "Estimated Reading Time: 5 minutes").

1.3 INTRODUCTION (60–120 words):
   - ${snippetIntroRule}
   - The primary keyword "${primaryKeyword}" MUST appear naturally within the first 100 words.
   - Explain the search intent immediately in the first paragraph.
   - NEVER start with any of these AI patterns:
     * "In this article/guide/post, you'll learn/explore/discover..."
     * "This article covers/discusses/examines..."
     * "It's essential/important/crucial to understand..."
     * "Let's explore/dive into/take a look at..."
     * "Understanding X can help you..."
     * Any sentence that describes the article instead of just delivering the content.

1.5 TABLE OF CONTENTS:
   - Include a short, bulleted Table of Contents right after the introduction linking to the H2 headings (e.g. * [Why Good CTR Matters](#why-good-ctr-matters)).

2. PARAGRAPH STRUCTURE:
   - 2–4 sentences per paragraph. Keep paragraphs highly readable: 40–90 words, and exactly 2 to 4 lines.
   - Every paragraph should make ONE point simply. No long walls of text.
   - CRITICAL: If a section has a large amount of context or information to explain, do NOT write a large paragraph or dense block of text. Instead, break it down logically using subheadings (H3/H4) and explain the details with proper bullet points and short, readable paragraphs (40-90 words). The layout must feel clean, highly readable, and written by a human.

3. HEADING STRUCTURE:
   - At least 3 H2 headings. Each H2 heading MUST incorporate the primary keyword "${primaryKeyword}" in exact match.
   - At least 2 H3 headings. Each H3 heading MUST incorporate the primary keyword "${primaryKeyword}" (or the main topic subject keyword "${primaryKeyword.split(' ').pop()}") naturally.

4. KEYWORD TARGETING & DENSITY:
   - Primary keyword density: 0.5%–1%.
   - Put top level/primary keywords in exact match in headings and text.
   - Use synonyms and semantic/related keywords naturally in the text: ${(secondaryKeywords || []).join(', ')}.

5. ENGAGEMENT ELEMENTS:
   - Include a bullet list in the article under at least one heading.
   - ONE relevant quote from a famous/expert person. Format: > "Quote text." — Famous Person. Must be real, verifiable, and related to the topic.
   - A related comparison table comparing platforms, features, or details based on facts in the brief. Make it similar to the curd-vs-buttermilk comparison table style.

6. CHART DATA:
   - ${chartRule} If no verified metrics exist in the brief, output NO chart.

7. IMAGE PLACEHOLDERS:
   - Insert 2–3 image markers: <!-- IMAGE: [descriptive alt text] -->
   - Spread them across intro area, mid-article, and conclusion area.

8. ENDING PARAGRAPH:
   - At least 60 words.
   - Must incorporate the primary/main keyword "${primaryKeyword}" naturally.
   - End with a clear next step or actionable takeaway.

9. FAQ SECTION:
   - exactly 5–6 question-answer pairs targeting queries related to "${primaryKeyword}".
   - Each answer: strictly 20–40 words. Keep it short, concise, and direct (not too long).

10. SOURCES & REFERENCES:
    - ${authorRule}
    - End with a "Sources and References" section listing real reference domains used in the brief (e.g., Google Scholar, Wikipedia, industry blogs, and research reports). Do NOT invent new references.

BANNED PHRASES (never use these — they are AI fingerprints):
"delve", "furthermore", "moreover", "in conclusion", "testament to", "it is important to note",
"it's essential to", "it's crucial to", "landscape", "paradigm", "realm", "interplay",
"multifaceted", "the ever-evolving", "in today's world", "game changer", "navigating the",
"as we adapt to", "gear up for", "poised to", "at the end of the day", "the bottom line is",
"understanding these changes can help you", "plays a crucial role", "it goes without saying",
"in today's digital world", "in today's fast-paced world", "dive into", "delve into", "unlock",
"harness", "elevate", "revolutionize", "seamlessly", "robust", "cutting-edge", "consequently",
"whether you're", "imagine", "let's explore", "circle your calendars", "let's break down".

11. ACCURACY & FACT-CHECKING:
    - ${accuracyRules}

12. TIME-SENSITIVE CONTENT RULE:
    - If the Research Brief contains a "DATA SUFFICIENCY WARNING" or the user asks about schedules/fixtures for a specific date and the brief lacks verified fixture data, do NOT invent placeholder matches. State that no confirmed schedule was found.
    - NEVER generate fictional team names, placeholder fixture lists, or hypothetical scores.

13. FUTURE EVENT RULE:
    - If the Research Brief contains a "FUTURE EVENT WARNING" and sources lack confirmed details for the specific season/year:
      a) Do NOT present schedules, venues, squads, results, or performance metrics as confirmed.
      b) Do NOT copy data from previous seasons as current-year data.
      c) State that official details have not been announced yet where data is missing.
      d) You MAY write about history, format, expectations, and predictions CLEARLY LABELED as speculation.
      e) For FAQ answers about future events with unknown answers, write "Official information has not been announced yet."

${predictionRule ? `14. TACTICAL ANALYSIS & PREDICTION:\n   - ${predictionRule}` : ''}

TOTAL WORD COUNT TARGET: ${targetWordCount} words (use skyscraper technique — cover the topic more thoroughly than competitors).

Output clean markdown only. No preamble, no notes.`;

  const sections = parseOutline(outline);
  const t0 = Date.now();

  // If targetWordCount is large and we parsed multiple H2 sections, write section-by-section
  if (targetWordCount >= 1800 && sections.length > 1) {
    console.info(`[aiPipeline] Writing article section by section (${sections.length} sections)...`);
    let fullArticleText = '';

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      // Calculate section target word count dynamically:
      // Give the intro ~200 words, and divide the remainder among the H2 sections
      let sectionTarget = 200;
      if (!section.isIntro) {
        const h2SectionsCount = sections.filter(s => !s.isIntro).length || 1;
        sectionTarget = Math.max(250, Math.round((targetWordCount - 200) / h2SectionsCount));
      }

      if (onProgress) {
        onProgress({ 
          step: 'writing', 
          label: `Writing section ${i + 1} of ${sections.length}: ${section.heading}...` 
        });
      }

      const sectionPrompt = `You are writing a single section of a longer article on "${topic}".
      
Topic: ${topic}
Today's Date: ${currentDateStr}
Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(', ')}

Target word count for THIS section: ~${sectionTarget} words.

The section outline you are writing is:
---
${section.content.join('\n')}
---

Preceding content already written (for context, style, and flow - do NOT repeat this content, do NOT repeat these headings, just transition naturally from it):
---
${fullArticleText ? fullArticleText.slice(-6000) : '(This is the first section of the article)'}
---

Research Brief Grounding (Paraphrase the facts, do not copy verbatim):
---
${brief}
---

Write the content for this section now (include the H2 heading and any H3 subheadings from the outline). No notes, no preamble.`;

      const { text: sectionText } = await smartComplete('anthropic', system, sectionPrompt, { maxTokens: 2500 });
      fullArticleText += (fullArticleText ? '\n\n' : '') + sectionText;
    }

    return { content: fullArticleText, model: 'anthropic-sectioned', durationMs: Date.now() - t0, status: 'ok' };
  }

  // Fallback to single-pass writing for shorter target word counts
  const prompt = `Write the complete article based on this outline:
---
${outline}
---

Topic: ${topic}
Today's Date: ${currentDateStr} (Anchor relative terms like "tomorrow", "yesterday", "this week", or "next week" to this date. For example, if today is Thursday, June 25, 2026, then "tomorrow" is Friday, June 26, 2026, and "this weekend" is June 27-28, 2026).
Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(', ')}
Target word count: ${targetWordCount} words.
${isHypothetical ? 'CRITICAL: This matchup is HYPOTHETICAL and NOT officially scheduled yet. You MUST explicitly state in the first paragraph that this is a potential, projected, or simulated matchup if the teams qualify and advance to face each other. You must frame any kickoff date, time, and venue as projected slot details if the clash occurs, rather than as a confirmed scheduled match. The entire article must reflect this hypothetical framing.' : ''}

Research Brief Grounding (Paraphrase the facts, do not copy verbatim):
---
${brief}
---

Write the full article now.`;

  const { text, model } = await smartComplete('anthropic', system, prompt, { maxTokens: 4000 });
  return { content: text, model, durationMs: Date.now() - t0, status: 'ok' };
}

async function optimizeForSEO({ content, primaryKeyword, secondaryKeywords, includeMeta, authorName }) {
  if (!includeMeta) {
    return { metaTitle: '', metaDescription: '', slug: '', model: 'skipped', durationMs: 0, status: 'ok' };
  }

  const system = `You are an SEO expert. Output ONLY a JSON object. No markdown tags, no notes.
Format strictly as:
{
  "metaTitle": "Title containing primary keyword, strictly 50-60 characters",
  "metaDescription": "Description containing primary keyword naturally, strictly 150-160 characters",
  "urlSlug": "Clean, short, lowercase, hyphenated URL slug containing the primary keyword naturally, strictly under 50 characters"
}`;

  const prompt = `Article Content Snippet:
---
${content.slice(0, 4000)}
---

Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${(secondaryKeywords || []).join(', ')}

Create the SEO meta tags and url slug based on the article content.`;

  const t0 = Date.now();
  try {
    const { text, model } = await smartComplete('gemini', system, prompt, { maxTokens: 500 });
    const json = extractJson(text);
    const slug = json.urlSlug || (json.metaTitle || primaryKeyword || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return {
      metaTitle: json.metaTitle || '',
      metaDescription: json.metaDescription || '',
      slug,
      model,
      durationMs: Date.now() - t0,
      status: model === 'mock' ? 'fallback' : 'ok',
    };
  } catch (err) {
    const meta = extractFallbackMeta(content, primaryKeyword);
    const slug = (meta.metaTitle || primaryKeyword || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return { ...meta, slug, model: 'mock', durationMs: Date.now() - t0, status: 'fallback' };
  }
}

async function humanizePass(content, topic, primaryKeyword) {
  const t0 = Date.now();
  const niche = classifyNiche(topic, primaryKeyword);

  // Always run the local humanizer first — it's fast, free, and effective.
  const local = humanize(content, niche);

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

  let nicheGuidelines = '';
  if (niche === 'sports') {
    nicheGuidelines = `- Write with strong, authoritative sports analysis in the style of premium sports journalists (e.g., ESPN, The Athletic).
- Each paragraph must be 40–90 words (2–4 lines). No single-sentence paragraphs, no walls of text.
- Vary sentence length dynamically (blend punchy 5-word sentences with longer 25-word tactical breakdowns) to create a natural, human reading rhythm.
- Use natural contractions extensively (don't, it's, there's, can't, won't) to keep the tone engaging and organic.
- Absolutely ban generic introductions ("Circle your calendars!", "Let's dive in", "Here's the breakdown"). Start directly with the tactical stakes or preview facts.
- Maintain all tactical profiles, player names, stadium info, and exact numbers exactly as verified. Do NOT hallucinate.
- Preserve all image placeholders (<!-- IMAGE: ... -->), blockquotes, tables, and HTML chart blocks exactly as they appear.`;
  } else if (niche === 'finance') {
    nicheGuidelines = `- Highly Conversational & User-Friendly: Talk directly to the reader using "you" and "I/we". Use contractions (e.g., "don't", "it's", "here's").
- Each paragraph must be 40–90 words (2–4 lines). No single-sentence paragraphs, no walls of text.
- Engaging Transitions & Bold Formatting: Use bold lead-ins to grab attention (e.g., "**Here is the catch:**", "**The best part?**", "**Look:**", "**Why is this important?**").
- Retain all facts, custom charts, structured tables, subheadings, image placeholders, blockquotes, and schema structure from the original text. Ensure factual accuracy.`;
  } else {
    nicheGuidelines = `- Highly Conversational, Professional & User-Friendly: Talk directly to the reader. Use contractions naturally.
- Each paragraph must be 40–90 words (2–4 lines). No single-sentence paragraphs, no walls of text.
- Avoid robotic structures: Do NOT use sequential lists like "First,", "Second,", "Lastly," or dry transitions. Use smooth, conversational connections.
- Vary sentence structures and paragraph lengths dynamically to make the article sound like an expert explaining the topic face-to-face.
- Avoid AI buzzwords and dry language: Never use "delve", "moreover", "furthermore", "in conclusion", "testament", "it is crucial to remember". Write simply and dynamically.
- Retain all facts, custom charts, structured tables, subheadings, image placeholders, blockquotes, and schema structure from the original text.`;
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const system = `You are a senior journalist rewriting the article below to sound highly human-written, engaging, and polished. Study and follow the writing style of this lifestyle blog article: https://flypped.com/lifestyle/benefits-of-buttermilk
 
 VOICE & TONE (this is the #1 priority):
 - Warm, direct, natural, and human tone. Explain things clearly and simply as a human author would.
 - Do NOT use typical AI introductory/transition fillers.
 - Use simple words and phrases. Avoid complex jargon or unnatural, flowery language.
 - Use synonyms and semantic/related keywords naturally throughout the text instead of repeating the same keyword mechanically.
 - Use natural contractions always: "don't", "isn't", "won't", "it's", "here's", "that's".

 STRICT WRITING RULES:
 1. Avoid AI Clichés:
    - Do NOT use phrases like: "In today's digital world", "In today's fast-paced world", "Dive into", "Delve into", "Unlock", "Harness", "Elevate", "Revolutionize", "It is important to note", "Seamlessly", "Robust", "Cutting-edge", "Furthermore", "Moreover", "Consequently", "Whether you're", "Imagine", "Let's explore", "circle your calendars", "let's break down".
    - Avoid generic introductions or meta-commentary like "In this article, we will...".
 2. Paragraph Readability:
    - Keep paragraphs short and easy to read. Each paragraph MUST be between 40 and 90 words, and exactly 2 to 4 lines. No single-sentence paragraphs, and no huge walls of text.
    - CRITICAL: If a paragraph or section has a large amount of details or context to explain, do NOT write it as a single block. Break it down logically using subheadings (H3/H4) and describe details using clean bullet points and short paragraphs to keep the text natural and readable like human writing.
 3. Heading Structure:
    - Ensure there is only one H1 title.
    - Ensure H2 and H3 headings include the primary keyword "${primaryKeyword}" in exact match.
 4. Engagement & Elements:
    - Preserve all comparison tables, quotes, bullet lists, and image placeholders.
 5. Ending Paragraph:
    - Must be at least 60 words, including the primary keyword "${primaryKeyword}" naturally.
 6. FAQ Section:
    - Ensure there are 5-6 FAQs, with answers strictly 20–40 words long (short and concise).
 7. Reading Time:
    - Ensure there is an "Estimated Reading Time: X minutes" block below the H1 title.
 8. Formatting & Readability:
    - Remove every sentence that sounds AI-generated.
    - Replace generic advice with specific examples.
    - Improve transitions naturally.
    - Do not shorten the article (skyscraper technique, target 1000 - 1100 words overall).

 ${nicheGuidelines}
 
 PRESERVATION RULES (critical):
 - Keep ALL facts, numbers, data, and claims exactly as they are.
 - Preserve ALL: image placeholders (<!-- IMAGE: ... -->), blockquotes (> ...), markdown tables, HTML chart blocks (<div class="custom-chart">), FAQ sections, and headings.
 - Same structure, same sections, same order.
 - Today's Date: ${currentDateStr}. Preserve all dates, times, and proper nouns.
 
 Output clean markdown only. Do NOT start with "Here is the rewritten article" or any preamble.`;

  try {
    const wordCount = local.text.trim().split(/\s+/).length;
    
    // If article is large, humanize section by section in parallel to prevent output length constraints/truncation
    if (wordCount >= 1800) {
      const parts = local.text.split(/(?=^##\s+[^#])/gm);
      if (parts.length > 1) {
        console.info(`[aiPipeline] Humanizing article in parallel (${parts.length} sections)...`);
        const humanizedParts = await Promise.all(
          parts.map(async (part) => {
            if (!part.trim()) return '';
            try {
              const { text } = await smartComplete('anthropic', system, part, { maxTokens: 2500 });
              return postLlmValidation(text, niche);
            } catch (err) {
              console.warn(`[humanizePass] Section humanization failed, using original: ${err.message}`);
              return part;
            }
          })
        );
        const combinedContent = humanizedParts.filter(Boolean).join('\n\n');
        const rescored = humanize(combinedContent, niche);
        return {
          content: combinedContent,
          aiScoreBefore: local.aiScoreBefore,
          aiScoreAfter: rescored.aiScoreAfter,
          model: 'anthropic-sectioned',
          durationMs: Date.now() - t0,
          status: 'ok',
        };
      }
    }

    const { text, model } = await smartComplete('anthropic', system, local.text, { maxTokens: 4000 });
    // Re-run phrase/contraction cleanup to catch patterns the LLM re-introduced
    const validated = postLlmValidation(text, niche);
    const rescored = humanize(validated, niche);
    return {
      content: validated,
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
  const written = await writeContent({ ...input, outline: outline.outline, insufficientData: input.insufficientData });
  steps.push({ step: 'writing', model: written.model, durationMs: written.durationMs, status: written.status });

  onProgress({ step: 'seo', label: 'Optimizing SEO and humanizing content...' });
  const [optimized, humanized] = await Promise.all([
    optimizeForSEO({
      content: written.content,
      primaryKeyword: input.primaryKeyword,
      secondaryKeywords: input.secondaryKeywords,
      includeMeta: input.includeMeta !== false,
      authorName: input.authorName,
    }),
    humanizePass(written.content, input.topic, input.primaryKeyword)
  ]);
  steps.push({ step: 'seo', model: optimized.model, durationMs: optimized.durationMs, status: optimized.status });
  steps.push({ step: 'humanize', model: humanized.model, durationMs: humanized.durationMs, status: humanized.status });

  let images = [];
  if (input.includeImages) {
    const niche = classifyNiche(input.topic, input.primaryKeyword);
    const textNormalized = `${input.topic} ${input.primaryKeyword || ''}`.toLowerCase();

    const CATEGORY_IMAGES = {
      sports_soccer: [
        { url: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec8d?q=80&w=600&auto=format&fit=crop', alt: 'Soccer ball on field', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop', alt: 'Sports arena stadium lights', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop', alt: 'Athletes racing on track', credit: 'Unsplash Stock' }
      ],
      sports_cricket: [
        { url: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=600&auto=format&fit=crop', alt: 'Cricket stadium and pitch', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?q=80&w=600&auto=format&fit=crop', alt: 'Cricket bat and ball', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1607734834834-d4d48587b0d8?q=80&w=600&auto=format&fit=crop', alt: 'Cricket player match', credit: 'Unsplash Stock' }
      ],
      sports_general: [
        { url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop', alt: 'Sports arena stadium lights', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop', alt: 'Athletes racing on track', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop', alt: 'Training workout session', credit: 'Unsplash Stock' }
      ],
      finance_payments: [
        { url: 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?q=80&w=600&auto=format&fit=crop', alt: 'Online payments and credit cards', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=600&auto=format&fit=crop', alt: 'Financial consulting and calculations', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=600&auto=format&fit=crop', alt: 'Growing money coins', credit: 'Unsplash Stock' }
      ],
      finance_general: [
        { url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=600&auto=format&fit=crop', alt: 'Financial trading chart dashboard', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600&auto=format&fit=crop', alt: 'Business financial planning session', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1559526324-52a170567e7c?q=80&w=600&auto=format&fit=crop', alt: 'Accounting calculations ledger', credit: 'Unsplash Stock' }
      ],
      tech_general: [
        { url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=600&auto=format&fit=crop', alt: 'Software coding on laptop', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=600&auto=format&fit=crop', alt: 'Technology device screens', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop', alt: 'Electronic circuit logic board', credit: 'Unsplash Stock' }
      ],
      general: [
        { url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=600&auto=format&fit=crop', alt: 'Workspace typing', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=600&auto=format&fit=crop', alt: 'Books reading and education', credit: 'Unsplash Stock' },
        { url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop', alt: 'Creative desk workspace', credit: 'Unsplash Stock' }
      ]
    };

    let pool = CATEGORY_IMAGES.general;
    if (niche === 'sports') {
      if (textNormalized.includes('cricket')) {
        pool = CATEGORY_IMAGES.sports_cricket;
      } else if (textNormalized.includes('soccer') || textNormalized.includes('football') || textNormalized.includes('cup')) {
        pool = CATEGORY_IMAGES.sports_soccer;
      } else {
        pool = CATEGORY_IMAGES.sports_general;
      }
    } else if (niche === 'finance') {
      if (textNormalized.includes('payment') || textNormalized.includes('wise') || textNormalized.includes('money') || textNormalized.includes('card')) {
        pool = CATEGORY_IMAGES.finance_payments;
      } else {
        pool = CATEGORY_IMAGES.finance_general;
      }
    } else {
      if (textNormalized.includes('code') || textNormalized.includes('tech') || textNormalized.includes('software')) {
        pool = CATEGORY_IMAGES.tech_general;
      }
    }

    images = [...pool];
  }

  let cleanContent = humanized.content;

  // Programmatically strip redundant "Estimated Reading Time" and "Introduction" headings
  cleanContent = cleanContent.replace(/^(?:\*|#)*Estimated Reading Time:?\s*\d+\s*(?:minutes|mins)?(?:\*|#)*$/gim, '');
  cleanContent = cleanContent.replace(/^##\s*(?:Introduction|Intro)\s*$/gim, '');
  cleanContent = cleanContent.trim();

  if (images.length > 0) {
    let imgIndex = 1; // start replacing from index 1 (index 0 is reserved for top banner!)
    cleanContent = cleanContent.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (match, altText, url) => {
      if (url === '#' || url === '' || url.includes('placeholder')) {
        const img = images[imgIndex % images.length];
        imgIndex++;
        return `![${altText || img.alt}](${img.url})`;
      }
      return match;
    });
  }

  const faqs = extractFaqsFromContent(cleanContent);
  const jsonLd = buildJsonLdSchema({
    title: optimized.metaTitle || input.topic,
    description: optimized.metaDescription || '',
    authorName: input.authorName,
    faqs
  });

  return {
    outline: outline.outline,
    content: `${cleanContent}\n\n${jsonLd}`,
    metaTitle: optimized.metaTitle,
    metaDescription: optimized.metaDescription,
    slug: optimized.slug,
    aiScoreBefore: humanized.aiScoreBefore,
    aiScoreAfter: humanized.aiScoreAfter,
    pipelineSteps: steps,
    images,
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

function extractFaqsFromContent(content) {
  const faqs = [];
  const faqSection = content.split(/##\s*FAQ/i)[1];
  if (!faqSection) return faqs;

  const lines = faqSection.split('\n');
  let currentQuestion = null;
  let currentAnswer = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const lowerLine = line.toLowerCase();
    if (line.startsWith('#') || lowerLine.startsWith('conclusion') || lowerLine.startsWith('sources') || lowerLine.startsWith('about the') || lowerLine.startsWith('wrapping up')) {
      break;
    }

    const isNumbered = /^\d+\.\s+/.test(line);
    const isBoldQuestion = /^\*\*(.*?)\*\*/.test(line) && line.includes('?');
    const isRawQuestion = line.endsWith('?') && line.length < 150;

    if (isNumbered || isBoldQuestion || isRawQuestion) {
      if (currentQuestion && currentAnswer.length > 0) {
        faqs.push({
          question: currentQuestion,
          answer: currentAnswer.join(' ').replace(/^[-*\s\+]+/, '').trim()
        });
      }
      currentQuestion = line
        .replace(/^\d+\.\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/:\s*$/, '')
        .trim();
      currentAnswer = [];
    } else if (currentQuestion) {
      currentAnswer.push(line);
    }
  }

  if (currentQuestion && currentAnswer.length > 0) {
    faqs.push({
      question: currentQuestion,
      answer: currentAnswer.join(' ').replace(/^[-*\s\+]+/, '').trim()
    });
  }

  return faqs;
}

function buildJsonLdSchema({ title, description, authorName, faqs }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": {
          "@type": authorName ? "Person" : "Organization",
          "name": authorName || "Editorial Team"
        }
      }
    ]
  };

  if (faqs && faqs.length > 0) {
    schema["@graph"].push({
      "@type": "FAQPage",
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.answer
        }
      }))
    });
  }

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

// ---- Mock fallbacks ------------------------------------------------------
function mockOutline(topic, n = 5) {
  const niche = classifyNiche(topic, topic);
  const capitalizedTopic = topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (niche === 'sports') {
    return `# ${capitalizedTopic}: Match Preview, Prediction & Stats

## Match Preview: ${capitalizedTopic} details
A comprehensive preview of the upcoming match.

## Head-to-Head History and Stats: ${capitalizedTopic}
An analysis of previous head-to-head encounters between the teams.

## Predicted Lineups and Tactical Key Matchups
Expected team lineups, formations, and tactical plans.

## Match Analysis & Win Probability
Deep dive into tactical strengths, weaknesses, and predicted win percentages.

## Final Match Prediction: Who Will Win?
Expert verdict on the predicted match outcome.

## FAQ Section
### Who will win ${capitalizedTopic}?
### Where can I watch ${capitalizedTopic} live?
### Who are the key players?
### What is the head-to-head record between these teams?

## About the Author
A brief sports writer E-E-A-T profile.

## Sources and References
List of official team sources and sports database references.`;
  }

  if (niche === 'finance') {
    return `# Complete Guide to ${capitalizedTopic}: Fees, Options & Compliance

## Introduction to ${capitalizedTopic}
Overview of international financial transactions and rules.

## Best Platforms and Methods for ${capitalizedTopic}
A comparison of bank transfers, Wise, PayPal, and others.

## Fee Structure & Processing Times Comparison
Analyzing transaction costs, markup fees, and speeds.

## Regulatory Guidelines & Compliance
Important compliance rules, purpose codes, and RBI/FEMA regulations.

## Step-by-Step Guide to getting started
Practical instructions for setting up accounts.

## FAQ Section
### Can I receive international payments in my Indian bank account?
### Can UPI receive international payments?
### How much money can I receive from abroad in India?
### Do I need GST to receive foreign payments?

## About the Author
A brief finance advisor/CA profile.

## Sources and References
Official regulatory links and documentation.`;
  }

  // General
  return `# The Ultimate Guide to ${capitalizedTopic}: Key Insights and Tips

## What is ${capitalizedTopic}?
An introduction and overview of the subject.

## Core Principles and Benefits of ${capitalizedTopic}
Exploring the main advantages and core pillars.

## Key Challenges and How to Overcome Them
Common obstacles faced and actionable solutions.

## Best Practices and Expert Tips
Top strategies for optimization and success.

## Future Trends and Developments in ${capitalizedTopic}
Where the industry is heading in the coming years.

## FAQ Section
### What are the main benefits of ${capitalizedTopic}?
### How do I get started with ${capitalizedTopic}?
### What are the common mistakes to avoid?

## About the Author
A professional writer E-E-A-T profile.

## Sources and References
High-authority articles and references.`;
}

function mockArticle(topic, outline, targetWordCount = 1200) {
  const niche = classifyNiche(topic, topic);
  const capitalizedTopic = topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  let intro = '';
  let body = '';

  if (niche === 'sports') {
    intro = `The highly anticipated clash of ${capitalizedTopic} is scheduled to take place soon. Sports fans around the world are looking forward to a thrilling contest, analyzing lineups, form, and tactical matchups. In this preview, we cover everything you need to know about kickoff times, head-to-head stats, and predictions.`;
    
    body = `
## Match Preview: ${capitalizedTopic} details
The upcoming match is drawing massive fan interest. Finding the exact kickoff details, date, and venue is crucial for fans planning to watch. Both teams enter this match with high stakes, looking to confirm their position in the standings.

## Head-to-Head History and Stats: ${capitalizedTopic}
Historically, encounters between these teams have been highly competitive. Analyzing past head-to-head statistics reveals a fascinating balance of power, with both sides experiencing key wins and draws over the years.

| Metric | Team A | Team B |
|---|---|---|
| FIFA Rank / Standings | High | Mid |
| Recent Form | W-W-L-D | W-L-D-D |

## Predicted Lineups and Tactical Key Matchups
Tactically, both managers are expected to field strong starting lineups. The tactical battle in the midfield will be critical, alongside the attacking width and defensive organization.

## Match Analysis & Win Probability
Win probability forecasts suggest a highly tight encounter:
- Home Win: 45%
- Draw: 30%
- Away Win: 25%

## Final Match Prediction: Who Will Win?
Given the home advantage and recent form, we predict a highly competitive match resulting in a narrow victory or a hard-fought draw.

## FAQ Section
- **Who will win ${capitalizedTopic}?**
  The match is highly competitive, but home advantage may play a key role.
- **Where can I watch ${capitalizedTopic} live?**
  Broadcasts will be available on major sports channels and streaming apps.
- **Who are the key players?**
  Key players to watch include the top goalscorers and midfield controllers for both sides.
- **What is the head-to-head record between these teams?**
  Historical encounters show a tight margin with both teams having notable victories.

## About the Author
Written by the Editorial Team.

## Sources and References
- Official FIFA database
- Reputable sports media reports
- Historic match archives
`;
  } else if (niche === 'finance') {
    intro = `Managing ${capitalizedTopic} effectively is crucial for businesses and freelancers looking to optimize transaction fees and compliance. In this comprehensive guide, we explain the best platforms, fee structures, and regulatory guidelines to ensure hassle-free transfers.`;
    
    body = `
## Introduction to ${capitalizedTopic}
Understanding the basics of international remittance is key to avoiding hidden markup costs. Navigating RBI and FEMA regulations ensures that all transactions are compliant.

## Best Platforms and Methods for ${capitalizedTopic}
Several platforms offer reliable services. Compare Wise, PayPal, Payoneer, and direct bank SWIFT transfers to choose the right fit.

## Fee Structure & Processing Times Comparison
Platforms charge different combinations of fixed fees, percentage fees, and currency conversion spreads:
- Wise: 0.5% - 1.5% fee, mid-market rate.
- PayPal: 3.4% - 4.4% fee, higher markup.

## Regulatory Guidelines & Compliance
To stay compliant with tax authorities, always declare the correct purpose code (e.g. software exports, consulting) and obtain your digital FIRA documents.

## Step-by-Step Guide to getting started
To get started:
1. Link your Indian bank account.
2. Confirm your business details and declare purpose codes.
3. Complete the identity verification.

## FAQ Section
- **Can I receive international payments in my Indian bank account?**
  Yes, via direct wire, Wise, PayPal, or Stripe.
- **Can UPI receive international payments?**
  UPI now supports international incoming payments from selected countries like Singapore and UAE.
- **How much money can I receive from abroad in India?**
  There is no universal inward remittance limit under FEMA, but banks require declarations.

## About the Author
Written by the Editorial Team.

## Sources and References
- RBI Master Directions on Remittance
- Official platform pricing pages
`;
  } else {
    intro = `Understanding the core concepts of ${capitalizedTopic} is essential for success. In this guide, we break down what matters, why it is key, and how to implement best practices to get the most value out of ${capitalizedTopic}.`;
    
    body = `
## What is ${capitalizedTopic}?
An overview of ${capitalizedTopic} and its applications in the modern industry.

## Core Principles and Benefits of ${capitalizedTopic}
Implementing ${capitalizedTopic} provides significant advantages, including cost efficiency, improved quality, and scalable growth.

## Key Challenges and How to Overcome Them
While ${capitalizedTopic} is beneficial, common challenges include adoption speed and complexity. Focus on training and systematic changes.

## Best Practices and Expert Tips
Top strategies for optimization:
- Ground your actions in verified data.
- Start small and scale systematically.
- Monitor metrics continuously.

## Future Trends and Developments in ${capitalizedTopic}
Expect automation and AI to play a significant role in the future trajectory of this field.

## FAQ Section
- **What are the main benefits of ${capitalizedTopic}?**
  It offers increased efficiency, better scalability, and modern standards.
- **How do I get started with ${capitalizedTopic}?**
  Understand your baseline requirements first, then choose matching tools.

## About the Author
Written by the Editorial Team.

## Sources and References
- Academic research journals
- Industry consensus guidelines
`;
  }

  return [`# ${capitalizedTopic}`, '', intro, body].join('\n');
}

function mockResponse(system, prompt) {
  if (/outline/i.test(system) || /outline/i.test(prompt)) {
    const topic = (prompt.match(/"([^"]+)"/) || [])[1] || 'this topic';
    return mockOutline(topic, 5);
  }
  if (/JSON/i.test(system)) {
    return '{"metaTitle":"A practical guide for modern readers","metaDescription":"Plain, useful guidance with examples and the occasional honest aside, written for people who actually want to learn.","refinedContent":""}';
  }
  if (/title/i.test(system) || /title/i.test(prompt)) {
    const topic = (prompt.match(/"([^"]+)"/) || [])[1] || 'this topic';
    return [
      `1. The Ultimate Guide to ${topic}`,
      `2. 10 Surprising Facts About ${topic}`,
      `3. How to Master ${topic} in 5 Easy Steps`,
      `4. Why ${topic} is the Next Big Thing`,
      `5. The Beginner's Guide to ${topic}`,
      `6. Mastering ${topic}: A Practical Handbook`,
      `7. What Everyone Gets Wrong About ${topic}`,
      `8. 5 Proven Ways to Improve Your ${topic}`,
      `9. The Future of ${topic}: What to Expect`,
      `10. Insider Secrets of ${topic} Revealed`
    ].join('\n');
  }
  if (/rewrite/i.test(system) || /paraphrase/i.test(system) || /rephrase/i.test(system)) {
    // Just return the original text since it's a mock
    return prompt;
  }
  const topic = (prompt.match(/Topic:\s*(.+)$/m) || [])[1] || 'this topic';
  return mockArticle(topic, mockOutline(topic), 1200);
}

module.exports = {
  runPipeline,
  // exposed for the /tools endpoints
  generateOutline,
  writeContent,
  optimizeForSEO,
  humanizePass,
  smartComplete,
};
