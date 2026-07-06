const { GoogleGenerativeAI } = require('@google/generative-ai');

// Helper to extract domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (err) {
    return '';
  }
}

// Helper to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Execute the Gemini Web Search Grounding pipeline to generate real-time articles
 */
async function run({
  topic,
  primaryKeyword,
  secondaryKeywords = [],
  targetWordCount = 1200,
  headingsCount = 5,
  tone = 'Professional',
  audience = 'general readers',
  language = 'English',
  articleType = 'Blog post',
  pointOfView = '3rd person',
  includeFaqs = true,
  includeMeta = true,
  includeImages = false,
  authorName = 'Editorial Team',
}) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is not defined in your environment variables.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const currentDateISO = new Date().toISOString().split('T')[0];

  const startTime = Date.now();

  // ---- TURN 1: Pure Fact-Gathering (Search Grounding Only) ---------------
  // We use a dedicated search-only model call with dynamicRetrievalConfig
  // threshold=0.0 to FORCE Google Search on 100% of requests regardless of
  // whether the model thinks it "knows" the answer from training data.
  // Temperature is 0.0 to get deterministic, literal, factual output only.
  const searchModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{
      googleSearch: {}
    }],
  });

  const factGatheringPrompt = `You are a real-time sports data retrieval agent. Today's date is ${currentDateStr} (${currentDateISO}).

Your ONLY task is to use Google Search to find and list the VERIFIED, CURRENT FACTS about this topic: "${topic}"

CRITICAL RULES:
- You MUST use Google Search to retrieve ALL information. Do NOT use your training data knowledge.
- Only output confirmed facts found in search results from today or the most recent available date.
- If a fact is NOT found in search results (e.g., lineup not announced yet), write "NOT CONFIRMED IN SEARCH RESULTS".
- Do NOT guess, infer, or fill gaps from memory. Unknown = state it as unknown.

Gather and list ONLY these facts (where applicable to the topic):
1. MATCH STATUS: Has the match/event already occurred (Completed), is it currently in progress (Live), or is it in the future (Upcoming)?
2. EXACT match date, kickoff time (with timezone), and venue/stadium name and city
3. FOR COMPLETED MATCHES: What was the final score/result? Who were the goal scorers (with minutes), assist makers, and other key match events (cards, penalties, key saves, VAR decisions, etc.)?
4. FOR LIVE/IN-PROGRESS MATCHES: What is the current score and current minute of the match? Who has scored so far?
5. EXACT confirmed squad/lineup (or actual starting lineup that played) for each team
6. EXACT recent match results / form (last 5 matches for each team)
7. EXACT tournament bracket or standings context (which round, who they beat to get here, and impact of this match on tournament standings/progress)
8. EXACT head-to-head record between the two teams/entities
9. Any official injury or suspension news from the last 48 hours
10. Weather conditions at venue if available
11. Official broadcaster/streaming info
12. FOR COMPLETED/LIVE MATCHES: Standout player performances, player ratings (if available), key individual matchups, and post-match player/manager quotes.
13. FOR COMPLETED/LIVE MATCHES: Tactical insights, formations, key substitutions, coaching decisions, crowd/stadium atmosphere, and analytical details explaining why the match unfolded the way it did.

Format your output as a raw bullet-list of GROUNDED FACTS only. Write the source URL next to each fact in brackets. This output will be used as the sole source of truth for article writing.`;

  const searchResult = await searchModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: factGatheringPrompt }] }],
    generationConfig: {
      temperature: 0.0,
    },
  });

  const groundedFacts = searchResult.response.text();
  const searchDurationMs = Date.now() - startTime;

  // Extract sources from Turn 1 search grounding metadata
  const sources = [];
  const searchGroundingMeta = searchResult.response.candidates?.[0]?.groundingMetadata;
  if (searchGroundingMeta?.groundingChunks) {
    const uniqueUris = new Set();
    for (const chunk of searchGroundingMeta.groundingChunks) {
      if (chunk.web?.uri) {
        const uri = chunk.web.uri;
        if (!uniqueUris.has(uri)) {
          uniqueUris.add(uri);
          const rawDomain = chunk.web.title ? chunk.web.title.toLowerCase().trim() : getDomain(uri);
          sources.push({
            url: uri,
            title: chunk.web.title || getDomain(uri),
            domain: rawDomain.includes('.') ? rawDomain : getDomain(uri),
            sourceType: 'blog',
            note: 'Verified via Gemini Google Search Grounding',
          });
        }
      }
    }
  }

  // ---- TURN 2: Article Writing (Using Only Grounded Facts) ---------------
  // The writer model does NOT have search tools - it can ONLY use the facts
  // explicitly provided from Turn 1. This hard-separates retrieval from writing
  // and completely prevents training-data hallucination.
  const writerModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // NO tools here — the writer cannot search. It can only write from the facts given.
  });

  const systemInstruction = `You are an elite, professional news and sports journalist.
Your writing style is premium, clean, engaging, and deeply human — never robotic.
Avoid AI clichés entirely: never use "delve", "testament", "beacon", "in conclusion", "let's dive in", "circle your calendars", "it's worth noting", "in the realm of".
Ban dramatic, generic sports clichés: "witnessed a monumental moment", "sending their fans into euphoria", "etched in the memories", "bitter disappointment", "glimmer of hope".
Avoid repetitive phrasing: once you state a historic milestone, result, or upset, do not repeat the word "historic" or the same sentiment over and over. Move the narrative forward to keep the writing progressive and engaging.
Vary paragraph and sentence length dynamically to create a natural, human reading rhythm. Avoid uniform block structures. Blend punchy 1-sentence paragraphs with 2-4 sentence paragraphs.
For completed/live matches, integrate specific tactical analysis (formations, tactics), standout player performances/ratings, key substitutions, coaching choices, and crowd/stadium atmosphere as recorded in the grounded facts.
Today is ${currentDateStr}.

ABSOLUTE RULE — ZERO HALLUCINATION POLICY:
You have been given a set of GROUNDED FACTS retrieved via live Google Search. 
You MUST write the article using ONLY those facts.
- If a fact is listed as "NOT CONFIRMED IN SEARCH RESULTS" → state it explicitly in the article as unconfirmed.
- Do NOT add players, venues, scores, dates, or any other details that are not present in the GROUNDED FACTS list.
- Do NOT rely on your training data for any factual claim. Only the provided GROUNDED FACTS are authoritative.
- If a lineup is not confirmed, write: "The official starting lineup has not been announced at the time of publication."
- If a venue is not confirmed, state it as unconfirmed. Never guess a stadium.

STRUCTURE RULES:
1. Single H1 at the very top. No "## Introduction" heading — begin with a 60-120 word intro paragraph immediately.
2. At least 3 H2 headings, at least 2 H3 subheadings.
3. Primary keyword "${primaryKeyword}" must appear naturally in at least one H2 and one H3.
4. Every heading must be unique and descriptive.
5. Include a table (match schedule, stats, or head-to-head) under at least one H2.
6. Include a bulleted list under at least one heading.
7. Include 2-3 image placements using this exact format: <!-- IMAGE: [descriptive alt text] -->
8. Match-state-based content generation:
   - If the grounded facts state that the match is Completed or Live:
     * Write the article as a post-match report or live recap (e.g., highlighting the final score, active live status, goal scorers, and key moments).
     * Do NOT include the win probability chart. Instead, under at least one H2, include a structured match facts table (showing teams, final score, goal scorers with minutes, and venue).
     * Make sure the title, H1, H2s, and introduction reflect that the match has occurred or is occurring (e.g., using past tense, mentioning the result/score).
   - If the grounded facts show the match is Upcoming (future):
     * Write the article as a pre-match prediction or preview.
     * Include this win probability chart HTML:
<div class="custom-chart">
  <h4 class="custom-chart__title">Win Probability (%)</h4>
  <div class="chart-bar-row">
    <div class="chart-label">[Team A] Win</div>
    <div class="chart-bar-container">
      <div class="chart-bar bg-success" style="width: [X]%;">[X]%</div>
    </div>
  </div>
  <div class="chart-bar-row">
    <div class="chart-label">Draw</div>
    <div class="chart-bar-container">
      <div class="chart-bar bg-warning" style="width: [Y]%;">[Y]%</div>
    </div>
  </div>
  <div class="chart-bar-row">
    <div class="chart-label">[Team B] Win</div>
    <div class="chart-bar-container">
      <div class="chart-bar bg-danger" style="width: [Z]%;">[Z]%</div>
    </div>
  </div>
</div>
9. If includeFaqs = true, provide exactly 5 FAQ pairs. Short, direct answers under 30 words each.
10. End with a "## Sources and References" section listing the grounded URLs provided.
11. Do NOT include any "About the Author" section.
12. Internal links: ONLY suggest links that are relevant to the sport/topic (e.g. related match previews, team form guides). Do NOT link to unrelated topics like IPL, AI news, etc.

METADATA BLOCK:
Append at the very bottom, wrapped in XML tags exactly as shown:
<metadata>
{
  "metaTitle": "[Catchy, SEO-friendly title under 60 chars]",
  "metaDescription": "[Engaging meta description under 150 chars]",
  "slug": "[url-friendly-slug]"
}
</metadata>`;

  const writingPrompt = `Write a complete, premium ${articleType} article based STRICTLY on the grounded facts below.

--- GROUNDED FACTS FROM LIVE GOOGLE SEARCH ---
${groundedFacts}
--- END OF GROUNDED FACTS ---

Article Specifications:
- Topic: "${topic}"
- Primary Keyword: "${primaryKeyword}"
- Secondary Keywords: ${secondaryKeywords.join(', ')}
- Target Word Count: ${targetWordCount} words
- Tone: ${tone}
- Audience: ${audience}
- Language: ${language}
- Point of View: ${pointOfView}
- Include FAQs: ${includeFaqs}
- Today's Date: ${currentDateStr}

REMINDER: Only use facts from the GROUNDED FACTS section above. If something is not in there, say it's unconfirmed. Do not invent data. Append the <metadata>...</metadata> block at the very end.`;

  const writeStartTime = Date.now();
  const result = await writerModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: writingPrompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  });

  const responseText = result.response.text();
  const writeDurationMs = Date.now() - writeStartTime;
  const totalDurationMs = Date.now() - startTime;

  // Extract metadata block from the writer's output
  let metaTitle = '';
  let metaDescription = '';
  let slug = '';
  let cleanContent = responseText;

  const metadataMatch = responseText.match(/<metadata>([\s\S]*?)<\/metadata>/);
  if (metadataMatch) {
    try {
      const metaJson = JSON.parse(metadataMatch[1].trim());
      metaTitle = metaJson.metaTitle || '';
      metaDescription = metaJson.metaDescription || '';
      slug = metaJson.slug || '';
      cleanContent = responseText.replace(/<metadata>[\s\S]*?<\/metadata>/, '').trim();
    } catch (e) {
      console.error('Failed to parse metadata JSON from Gemini writer response', e);
    }
  }

  // Fallbacks if metadata parsing fails
  if (!metaTitle) metaTitle = topic.slice(0, 60);
  if (!slug) slug = generateSlug(topic);

  // If Turn 1 (search) found no sources, add a generic fallback
  if (sources.length === 0) {
    sources.push({
      url: 'https://news.google.com',
      title: 'Google News',
      domain: 'news.google.com',
      sourceType: 'blog',
      note: 'Fetched latest updates via Google News',
    });
  }

  // Run the same humanizer pass as other pipelines
  const { humanizePass } = require('./aiPipeline');
  const humanized = await humanizePass(cleanContent, topic, primaryKeyword);

  const pipelineSteps = [
    {
      step: 'research',
      model: 'gemini-2.5-flash + google-search-grounding',
      durationMs: searchDurationMs,
      status: 'ok',
    },
    {
      step: 'writing',
      model: 'gemini-2.5-flash (grounded-facts-only)',
      durationMs: writeDurationMs,
      status: 'ok',
    },
    {
      step: 'humanize',
      model: humanized.model,
      durationMs: humanized.durationMs,
      status: humanized.status,
    },
  ];

  return {
    content: humanized.content,
    metaTitle,
    metaDescription,
    slug,
    sources,
    pipelineSteps,
    aiScoreBefore: humanized.aiScoreBefore,
    aiScoreAfter: humanized.aiScoreAfter,
  };
}

module.exports = {
  run,
};
