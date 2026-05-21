/**
 * Web reference engine.
 *
 * Given a topic + keywords, this service:
 *   1. Calls SerpAPI (when SERPAPI_KEY is set) to get the top results.
 *   2. Falls back to a deterministic mock list if no key is configured.
 *   3. Scrapes each URL with axios + cheerio to extract titles, headings,
 *      and the first chunk of body text.
 *   4. Produces a "research brief" — a compact string the AI can ingest as
 *      grounding material, plus a structured `sources` array we persist.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const FETCH_TIMEOUT = 8000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; ContentForgeBot/1.0; +https://contentforge.local/bot)';

async function searchSerp(query) {
  if (!process.env.SERPAPI_KEY) {
    // Mock fallback — keeps the dev experience smooth without paid keys.
    return [
      { title: `${query} — overview`, link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`, snippet: `Background on ${query}.` },
      { title: `Guide to ${query}`, link: `https://www.investopedia.com/terms/${encodeURIComponent(query)}.asp`, snippet: `Practical guide to ${query}.` },
      { title: `${query} explained`, link: `https://www.bbc.com/news`, snippet: `Recent news context for ${query}.` },
    ];
  }

  const url = 'https://serpapi.com/search.json';
  const { data } = await axios.get(url, {
    params: { q: query, engine: 'google', num: 10, api_key: process.env.SERPAPI_KEY },
    timeout: FETCH_TIMEOUT,
  });

  return (data.organic_results || []).slice(0, 8).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }));
}

async function scrapePage(url) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: FETCH_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      maxContentLength: 2 * 1024 * 1024, // 2 MB cap
    });

    const $ = cheerio.load(html);
    const title = $('title').first().text().trim() || $('h1').first().text().trim();

    const headings = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text && text.length < 200) {
        headings.push({ level: el.tagName.toLowerCase(), text });
      }
    });

    // Strip script/style/nav junk and keep first ~1500 chars of meaningful text.
    $('script, style, nav, footer, aside').remove();
    const bodyText = $('article, main, body').first().text().replace(/\s+/g, ' ').trim();

    return {
      url,
      title,
      headings: headings.slice(0, 25),
      excerpt: bodyText.slice(0, 1500),
    };
  } catch (err) {
    return { url, error: err.message };
  }
}

/**
 * Identify subtopics covered by competitors so the smart-suggestions
 * service can flag gaps. Returns the most-frequent H2/H3 phrases.
 */
function summarizeCommonSubtopics(scraped) {
  const counts = new Map();
  scraped.forEach((page) => {
    (page.headings || []).forEach((h) => {
      const key = h.text.toLowerCase().slice(0, 80);
      if (key.length < 8) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .filter(([, n]) => n >= 2) // appears in at least 2 competitors
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text]) => text);
}

/**
 * Main entry point used by the AI pipeline.
 */
async function fetchResearchBrief({ topic, primaryKeyword, secondaryKeywords = [] }) {
  const query = [topic, primaryKeyword, ...secondaryKeywords].filter(Boolean).join(' ');
  const serpResults = await searchSerp(query);

  const scraped = await Promise.all(serpResults.slice(0, 5).map((r) => scrapePage(r.link)));
  const commonSubtopics = summarizeCommonSubtopics(scraped);

  const sources = serpResults.slice(0, 5).map((r, i) => ({
    url: r.link,
    title: r.title,
    snippet: r.snippet,
    note: scraped[i]?.error ? `Could not fetch: ${scraped[i].error}` : 'Scraped successfully',
  }));

  // Compact brief that fits comfortably in any LLM context window.
  const briefLines = [];
  briefLines.push(`# Research brief: ${topic}`);
  briefLines.push(`Primary keyword: ${primaryKeyword || '—'}`);
  if (secondaryKeywords.length) briefLines.push(`Secondary keywords: ${secondaryKeywords.join(', ')}`);
  briefLines.push('');
  briefLines.push('## What competitors cover');
  commonSubtopics.forEach((s) => briefLines.push(`- ${s}`));
  briefLines.push('');
  briefLines.push('## Source excerpts');
  scraped.forEach((p, i) => {
    if (!p.title) return;
    briefLines.push(`### Source ${i + 1}: ${p.title}`);
    briefLines.push(p.excerpt?.slice(0, 600) || '(no excerpt)');
    briefLines.push('');
  });

  return {
    brief: briefLines.join('\n'),
    sources,
    commonSubtopics,
  };
}

module.exports = { fetchResearchBrief };
