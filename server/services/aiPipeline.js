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
- At least 3 H2 headings: Ensure they incorporate the primary keyword "${primaryKeyword}" naturally. One H2 must cover the match preview/kickoff details. ${isHypothetical ? 'MANDATORY: Since this is a hypothetical/projected match (not officially scheduled yet), this heading must be framed as a "Potential Matchup Preview" or "Projected Clash Preview", rather than a confirmed kickoff details heading.' : 'One H2 must cover the match preview/kickoff details.'} Another H2 must focus on head-to-head history and stats.
- At least 2 H3 headings: Dedicate these to exact matches of other important secondary keywords like predicted lineups or tactical key matchups.
- Under at least one H2, include a structured comparison table comparing team stats (such as FIFA rankings or other verified metrics from the research brief). Do NOT include unverified stats like World Cup titles or head-to-head records if they are not explicitly present in the research brief.
- Under at least one H2, include a custom visual comparison chart in HTML format (using <div class="custom-chart"> wrapper) comparing team metrics (such as win probability or recent form) ONLY if they are verified in the research brief. If win probabilities are not verified in the brief, do NOT include unverified percentages; instead, compare verified stats or recent performance metrics.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous sports figure or analyst related to the matchup.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs targeting search queries related to the match. Do NOT invent answers to FAQs if the facts are not verified in the brief; write "Information not yet officially confirmed" for any unverified answers.`;
    } else {
      nicheRequirements = `
- If the Research Brief does not contain actual factual details about group standings, schedules, or team news for the requested topic, you MUST limit the outline to exactly two H2 headings: '1. Tournament Schedule and Status' and '2. FAQ'. Do NOT include headings for lineups, standings, tactics, or predictions if they are unverified.
- If the Research Brief does contain verified tournament/team facts, you may include:
  - At least 3 H2 headings: Ensure they incorporate the primary keyword "${primaryKeyword}" naturally. Focus on tournament status, group standings, schedules, or general team news as present in the research brief. Do NOT assume or invent specific matchups if none are verified in the brief.
  - At least 2 H3 headings: Focus on specific subtopics like key player updates, injury news, or tactical strategies from the research brief.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous sports figure or expert related to the topic.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs directly related to the topic "${topic}" and the primary keyword "${primaryKeyword}". Do NOT invent answers; write "Information not yet officially confirmed" if the facts are not in the brief.`;
    }
  } else if (niche === 'finance') {
    nicheRequirements = `
- At least 3 H2 headings: Ensure they incorporate the primary keyword "${primaryKeyword}" naturally. Dedicate at least two H2 headings specifically as questions targeting high-intent search queries.
- At least 2 H3 headings: Dedicate these to exact matches of other important secondary keywords.
- Under at least one H2, include a structured comparison table comparing platforms or requirements based on facts in the research brief.
- Under at least one H2, include a custom visual bar chart in HTML format (using <div class="custom-chart"> wrapper) comparing platforms, costs, or speeds.
- Include a bullet list under at least one H2 or H3.
- Plan a slot for one relevant quote from a famous finance expert, economist, or industry leader.
- Plan 2-3 image placement points spread across the article.
- Mark a dedicated FAQ section at the end with exactly 5-6 distinct question-answer pairs based on real-world search queries.`;
  } else {
    nicheRequirements = `
- At least 3 H2 headings: Each must incorporate the primary keyword "${primaryKeyword}" naturally.
- At least 2 H3 headings: Each must include the primary keyword or a close secondary keyword.
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
Target length: ~${targetWordCount} words.

MANDATORY outline requirements:${nicheRequirements}
${authorName ? `- Include a final H2 section titled "About the Author" (for E-E-A-T credentials).` : '- Do NOT include an "About the Author" section.'}
- Include a final H2 section titled "Sources and References".
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
  const system = `You write like the top SEO blogs: Ahrefs, Moz, Neil Patel, Search Engine Journal. Study their style:

VOICE & TONE (this is the #1 priority):
- Write like a knowledgeable friend explaining over coffee — not a professor giving a lecture.
- Be direct and confident. State things plainly: "This works." "This doesn't." "Here's why."
- Use "you" and "your" to talk directly to the reader.
- Use contractions always: "don't", "isn't", "won't", "it's", "here's", "that's".
- Add honest caveats when appropriate: "That said, this won't work for every site." / "Fair warning: this takes time."
- Share a clear opinion when relevant: "Most people overcomplicate this." / "The short answer? It depends."

Target audience: ${audience || 'readers looking for clear, friendly, and practical help'}.
Write in ${pointOfView || 'second'} person.
Today's Date: ${currentDateStr}.

ARTICLE TEMPLATE:

1. INTRODUCTION (60–120 words):
   - ${snippetIntroRule}
   - The primary keyword "${primaryKeyword}" MUST appear naturally within the first 100 words.
   - Start with DATA, a bold claim, or the direct answer to the search query. Like Ahrefs does: "We pulled data from 400,000 websites..." or like Neil Patel: "90% of pages get zero traffic from Google."
   - NEVER start with any of these AI patterns:
     * "In this article/guide/post, you'll learn/explore/discover..."
     * "This article covers/discusses/examines..."
     * "It's essential/important/crucial to understand..."
     * "Let's explore/dive into/take a look at..."
     * "Understanding X can help you..."
     * Any sentence that describes the article instead of just delivering the content.

2. SENTENCE RHYTHM (how Ahrefs/Moz actually write):
   - Mix sentence lengths dramatically. Short sentence. Then a longer one that explains the concept with a bit more nuance and context. Then another short one.
   - Some sentences are just 3-5 words: "That's the key." / "It works." / "Not always."
   - Others run 25-30 words with natural clauses joined by "and", "but", "because".
   - NEVER write 5 sentences in a row that are all the same length. That's the #1 AI detection signal.
   - ${styleRules}

3. PARAGRAPH STRUCTURE:
   - 2–4 sentences per paragraph. 40–90 words.
   - Some paragraphs are just 2 sentences. Others are 4. Vary it.
   - Every paragraph should make ONE point. Not two, not three. Just one. Then move on.

4. HEADING STRUCTURE:
   - Only ONE H1 (the title).
   - At least 3 H2 headings with "${primaryKeyword}" naturally included.
   - At least 2 H3 headings with the primary keyword or a secondary keyword.
   - Use question-format H2s where natural (like Ahrefs: "What Is a Good CTR?" not "Good CTR Overview").

5. KEYWORD TARGETING:
   - Primary keyword density: 0.5%–1%.
   - Secondary keywords naturally in text and subheadings: ${(secondaryKeywords || []).join(', ')}.
   - Use semantic variations and LSI keywords from the research brief.

6. ENGAGEMENT ELEMENTS:
   - At least ONE bullet list in the article.
   - ONE relevant quote from a real expert in the field. Format: > "Quote text." — Expert Name. Must be real, verifiable, and directly related to the topic. NOT a generic motivational quote.
   - A data table ONLY if the research brief has verified numbers. If not, skip it entirely.

7. CHART DATA:
   - ${chartRule} If no verified metrics exist in the brief, output NO chart.

8. IMAGE PLACEHOLDERS:
   - Insert 2–3 image markers: <!-- IMAGE: [descriptive alt text] -->
   - Spread them across intro area, mid-article, and conclusion area.

9. ENDING PARAGRAPH:
   - At least 60 words. Include "${primaryKeyword}" naturally.
   - End with a clear next step or actionable takeaway — not a vague summary.

10. FAQ SECTION:
   - 5–6 question-answer pairs targeting high-intent searches for "${primaryKeyword}".
   - Each answer: under 50 words. Direct and specific.

11. SOURCES & REFERENCES:
   - ${authorRule}
   - End with "Sources and References". ${contentMode === 'knowledge' ? 'List real references: Google Scholar, Wikipedia, industry blogs, research reports, official sites (NASA, WHO, etc.). Do NOT write "Information not yet officially confirmed" for evergreen topics.' : 'List sources from the research brief by title and domain.'}

BANNED PHRASES (never use these — they are AI fingerprints):
"delve", "furthermore", "moreover", "in conclusion", "testament to", "it is important to note",
"it's essential to", "it's crucial to", "landscape", "paradigm", "realm", "interplay",
"multifaceted", "the ever-evolving", "in today's world", "game changer", "navigating the",
"as we adapt to", "gear up for", "poised to", "at the end of the day", "the bottom line is",
"understanding these changes can help you", "plays a crucial role", "it goes without saying".

12. ACCURACY & FACT-CHECKING:
   - ${accuracyRules}

13. TIME-SENSITIVE CONTENT RULE:
   - If the Research Brief contains a "DATA SUFFICIENCY WARNING" or the user asks about schedules/fixtures for a specific date and the brief lacks verified fixture data, do NOT invent placeholder matches. State that no confirmed schedule was found.
   - NEVER generate fictional team names, placeholder fixture lists, or hypothetical scores.

14. FUTURE EVENT RULE:
   - If the Research Brief contains a "FUTURE EVENT WARNING" and sources lack confirmed details for the specific season/year:
     a) Do NOT present schedules, venues, squads, results, or performance metrics as confirmed.
     b) Do NOT copy data from previous seasons as current-year data.
     c) State that official details have not been announced yet where data is missing.
     d) You MAY write about history, format, expectations, and predictions CLEARLY LABELED as speculation.
     e) For FAQ answers about future events with unknown answers, write "Official information has not been announced yet."

${predictionRule ? `15. TACTICAL ANALYSIS & PREDICTION:\n   - ${predictionRule}` : ''}

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
    return { content, metaTitle: '', metaDescription: '', model: 'skipped', durationMs: 0, status: 'ok' };
  }

  const system = `You are an SEO expert. Output ONLY a JSON object. No markdown tags, no notes.
Format strictly as:
{
  "metaTitle": "Title containing primary keyword, strictly 50-60 characters",
  "metaDescription": "Description containing primary keyword naturally, strictly 150-160 characters",
  "refinedContent": "The markdown article, optimized with primary/secondary keywords and having a valid JSON-LD schema block appended at the ABSOLUTE END of the document"
}

JSON-LD Schema Rules:
- The JSON-LD must contain both an 'Article' and a 'FAQPage' context.
- Use the author name "${authorName || 'Editorial Team'}".
- The schema block must be placed at the VERY BOTTOM of the 'refinedContent', below all other text, headings, and tables.
- Format the schema as:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "<Title>",
      "description": "<Meta Description>",
      "author": { "@type": "${authorName ? 'Person' : 'Organization'}", "name": "${authorName || 'Editorial Team'}" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [ ... ]
    }
  ]
}
</script>`;

  const prompt = `Article Content:
---
${content}
---

Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${(secondaryKeywords || []).join(', ')}

Create the meta tags and append the JSON-LD script at the absolute end of the refinedContent (below everything else).`;

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
    const meta = extractFallbackMeta(content, primaryKeyword);
    return { content, ...meta, model: 'mock', durationMs: Date.now() - t0, status: 'fallback' };
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
  const system = `Rewrite the article below to match the writing style of Ahrefs, Moz, and Neil Patel blogs.

WHAT THAT STYLE SOUNDS LIKE:
- Confident and direct: "This works." "Here's why." "Most people get this wrong."
- Uses contractions everywhere: "don't", "isn't", "here's", "it's", "that's", "won't"
- Mixes sentence lengths dramatically: "Short point." Then a longer sentence that adds context with a natural "and" or "but" joining two thoughts. Then short again.
- Starts sentences with "But", "And", "So", "Now", "Still" sometimes — like real speech.
- Adds honest caveats: "One catch:", "That said,", "One caveat:", "This won't work for everyone."
- Uses "you" and "your" to talk directly to the reader.
- Explains complex ideas with simple comparisons: "Think of PageRank like a voting system."
- Stays specific — uses numbers, names, and examples instead of vague statements.

WHAT TO REMOVE (AI patterns):
- Any sentence starting with "In this article/guide, you'll learn/explore..."
- Filler: "It's important to note", "It goes without saying", "In today's world"
- Formal connectors: "furthermore", "moreover", "consequently", "additionally"
- Inflated words ONLY when they aren't topic keywords: "utilize" → "use", "facilitate" → "help"
- Passive constructions: "It should be noted that" → just state the fact directly.
- Uniform sentence lengths — if 3+ sentences in a row are similar length, rewrite them to vary.

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

  onProgress({ step: 'seo', label: 'Optimizing for SEO and meta tags...' });
  const optimized = await optimizeForSEO({
    content: written.content,
    primaryKeyword: input.primaryKeyword,
    secondaryKeywords: input.secondaryKeywords,
    includeMeta: input.includeMeta !== false,
    authorName: input.authorName,
  });
  steps.push({ step: 'seo', model: optimized.model, durationMs: optimized.durationMs, status: optimized.status });

  onProgress({ step: 'humanize', label: 'Humanizing for low AI-detection score...' });
  const humanized = await humanizePass(optimized.content, input.topic, input.primaryKeyword);
  steps.push({ step: 'humanize', model: humanized.model, durationMs: humanized.durationMs, status: humanized.status });

  let images = [];
  if (input.includeImages) {
    const niche = classifyNiche(input.topic, input.primaryKeyword);
    const textNormalized = `${input.topic} ${input.primaryKeyword || ''}`.toLowerCase();
    
    let url = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=600&auto=format&fit=crop';
    let alt = 'Workspace typing';
    let credit = 'Unsplash Stock';

    if (niche === 'sports') {
      if (textNormalized.includes('cricket')) {
        url = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=600&auto=format&fit=crop';
        alt = 'Cricket stadium and pitch';
      } else if (textNormalized.includes('soccer') || textNormalized.includes('football') || textNormalized.includes('cup')) {
        url = 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec8d?q=80&w=600&auto=format&fit=crop';
        alt = 'Soccer ball on field';
      } else {
        url = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop';
        alt = 'Sports arena stadium lights';
      }
    } else if (niche === 'finance') {
      if (textNormalized.includes('payment') || textNormalized.includes('wise') || textNormalized.includes('money') || textNormalized.includes('card')) {
        url = 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?q=80&w=600&auto=format&fit=crop';
        alt = 'Online payments and credit cards';
      } else {
        url = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=600&auto=format&fit=crop';
        alt = 'Financial trading chart dashboard';
      }
    } else {
      if (textNormalized.includes('code') || textNormalized.includes('tech') || textNormalized.includes('software')) {
        url = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=600&auto=format&fit=crop';
        alt = 'Software coding on laptop';
      }
    }
    
    images.push({ url, alt, credit });
  }

  return {
    outline: outline.outline,
    content: humanized.content,
    metaTitle: optimized.metaTitle,
    metaDescription: optimized.metaDescription,
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
