/**
 * Multi-Reference Web Research Engine
 * ------------------------------------
 * Discovers and scrapes 10-15 diverse real sources for any topic.
 * Extracts citable facts (stats, percentages, quotes) from each page.
 * Returns:
 *   - research brief   (compact text for AI grounding)
 *   - sources[]        (structured source list)
 *   - citableFacts[]   (extracted stats/quotes with attribution)
 *   - commonSubtopics  (competitor heading patterns)
 *   - citationBrief    (formatted "According to X..." lines for AI injection)
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ---------- Niche Classifier Helper ----------------------------------------
function classifyNiche(topic = '', primaryKeyword = '') {
  const text = `${topic} ${primaryKeyword}`.toLowerCase();

  // Sports indicators
  const sportsKeywords = [
    'vs', 'match', 'cup', 'league', 'stadium', 'football', 'soccer', 'cricket', 'basketball',
    'nba', 'nfl', 'player', 'lineup', 'prediction', 'win', 'watch', 'live', 'kickoff',
    'betting', 'odds', 'premier league', 'la liga', 'world cup', 'euros', 'copa america', 'champions league',
    'fifa', 'matches', 'fixtures', 'schedule'
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

// ---------- Temporal query helpers ----------------------------------------
// "Hard" temporal = asking about a specific date/time. Should block generation
// if data is missing for sports/schedule queries.
const HARD_TEMPORAL_KEYWORDS = [
  'tomorrow', 'today', 'tonight', 'yesterday', 'this week', 'this weekend',
  'next week', 'live', 'now', 'schedule', 'fixtures'
];
// "Soft" temporal = wants fresh content but not tied to a specific date.
// Should use fresher search filters but NEVER block article generation.
const SOFT_TEMPORAL_KEYWORDS = [
  'latest', 'recent', 'current', 'breaking', 'upcoming'
];
const ALL_TEMPORAL_KEYWORDS = [...HARD_TEMPORAL_KEYWORDS, ...SOFT_TEMPORAL_KEYWORDS];

function detectTemporalIntent(text) {
  const lower = text.toLowerCase();
  for (const kw of ALL_TEMPORAL_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function isHardTemporal(keyword) {
  return HARD_TEMPORAL_KEYWORDS.includes(keyword);
}

function resolveTemporalDate(keyword) {
  const now = new Date();
  const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  switch (keyword) {
    case 'tomorrow': {
      const d = new Date(now); d.setDate(d.getDate() + 1);
      return { label: 'tomorrow', date: fmt(d), isoDate: d.toISOString().slice(0, 10) };
    }
    case 'today':
    case 'tonight':
    case 'now':
    case 'live':
    case 'latest':
    case 'breaking':
    case 'current':
      return { label: 'today', date: fmt(now), isoDate: now.toISOString().slice(0, 10) };
    case 'yesterday':
    case 'recent': {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return { label: keyword, date: fmt(d), isoDate: d.toISOString().slice(0, 10) };
    }
    case 'this week':
    case 'this weekend':
    case 'upcoming':
    case 'schedule':
    case 'fixtures':
    case 'next week': {
      const end = new Date(now); end.setDate(end.getDate() + 7);
      return { label: keyword, date: `${fmt(now)} – ${fmt(end)}`, isoDate: now.toISOString().slice(0, 10) };
    }
    default:
      return null;
  }
}

// ---------- Content mode detection ----------------------------------------
// "news" = time-dependent content (matches, schedules, live events, breaking news)
// "knowledge" = evergreen/educational content (global warming, AI trends, how-to guides)
function detectContentMode(topic, primaryKeyword, niche, temporalKeyword, hardTemporal) {
  const text = `${topic} ${primaryKeyword || ''}`.toLowerCase();

  // Explicit news signals
  if (hardTemporal && (niche === 'sports')) return 'news';
  if (['live', 'now', 'tonight', 'fixtures', 'schedule'].includes(temporalKeyword)) return 'news';

  const newsPatterns = [
    'vs', 'match', 'score', 'lineup', 'kickoff', 'breaking news',
    'election results', 'press conference', 'announced today'
  ];
  if (newsPatterns.some(p => text.includes(p))) return 'news';

  return 'knowledge';
}

// ---------- Future event detection ----------------------------------------
function detectFutureEvent(topic, primaryKeyword) {
  const text = `${topic} ${primaryKeyword || ''}`.toLowerCase();
  const currentYear = new Date().getFullYear();

  // Check for year references (2025, 2026, 2027...)
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const mentionedYear = parseInt(yearMatch[1], 10);
    if (mentionedYear > currentYear) {
      return { isFuture: true, year: mentionedYear, reason: `References future year ${mentionedYear}` };
    }
    if (mentionedYear === currentYear) {
      return { isFuture: false, year: mentionedYear, isCurrentYear: true, reason: `References current year ${mentionedYear} — verify data exists` };
    }
  }

  // Check for explicit future phrasing
  const futureKeywords = ['upcoming season', 'next season', 'next year', 'coming soon', 'announced for'];
  if (futureKeywords.some(kw => text.includes(kw))) {
    return { isFuture: true, year: null, reason: 'Contains future-event phrasing' };
  }

  return null;
}

const FETCH_TIMEOUT = 15000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; ContentForgeBot/1.0; +https://contentforge.local/bot)';

// ---- Source type classifier -------------------------------------------------
function classifyDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (hostname.includes('wikipedia')) return 'wiki';
    if (hostname.includes('reddit') || hostname.includes('quora')) return 'forum';
    if (
      hostname.includes('ncbi') ||
      hostname.includes('scholar') ||
      hostname.includes('.edu') ||
      hostname.includes('pubmed')
    )
      return 'academic';
    if (
      hostname.includes('bbc') ||
      hostname.includes('cnn') ||
      hostname.includes('reuters') ||
      hostname.includes('techcrunch') ||
      hostname.includes('theguardian') ||
      hostname.includes('forbes') ||
      hostname.includes('bloomberg') ||
      hostname.includes('wsj') ||
      hostname.includes('nytimes') ||
      hostname.includes('washingtonpost') ||
      hostname.includes('theatlantic')
    )
      return 'news';
    return 'blog';
  } catch {
    return 'other';
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Fetch GNews API for high quality news results ------------------------
let gnewsQueue = Promise.resolve();
let isPrimaryGNewsKeyExhausted = false;

function getGNewsApiKey() {
  if (isPrimaryGNewsKeyExhausted && process.env.GNEWS_API_KEY_FALLBACK) {
    return process.env.GNEWS_API_KEY_FALLBACK;
  }
  return process.env.GNEWS_API_KEY;
}

async function fetchGNewsApi(query, temporalInfo = null) {
  const apiKey = getGNewsApiKey();
  if (!apiKey) {
    return [];
  }

  return new Promise((resolve) => {
    gnewsQueue = gnewsQueue.then(async () => {
      try {
        const activeKey = getGNewsApiKey();
        if (!activeKey) {
          resolve([]);
          return;
        }

        let cleanedQuery = query.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').trim();

        // Strip the resolved date tag if present to prevent empty keyword matches
        if (temporalInfo && temporalInfo.date) {
          cleanedQuery = cleanedQuery.replace(new RegExp(escapeRegExp(temporalInfo.date), 'gi'), '');
        }
        // Also strip common long date components to keep keywords clean
        cleanedQuery = cleanedQuery
          .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
          .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
          .replace(/\b\d{1,2},?\s+\d{4}\b/g, '') // e.g. "July 3, 2026" or "3, 2026"
          .replace(/\s+/g, ' ')
          .trim();

        const url = 'https://gnews.io/api/v4/search';
        const params = {
          q: cleanedQuery,
          lang: 'en',
          max: 10,
          apikey: activeKey
        };

        // If highly time sensitive, filter GNews by publication date using from/to parameters
        if (temporalInfo && temporalInfo.isoDate) {
          const date = new Date(temporalInfo.isoDate);
          
          // Start window: 3 days before the target date
          const fromDate = new Date(date);
          fromDate.setDate(fromDate.getDate() - 3);
          params.from = fromDate.toISOString().slice(0, 19) + 'Z';

          // End window
          const toDate = new Date(date);
          toDate.setHours(23, 59, 59);
          
          const now = new Date();
          if (temporalInfo.label.includes('week') || temporalInfo.label.includes('weekend') || temporalInfo.label.includes('schedule') || temporalInfo.label.includes('fixtures')) {
            const endLimit = new Date(now);
            endLimit.setDate(endLimit.getDate() + 7);
            params.to = endLimit.toISOString().slice(0, 19) + 'Z';
          } else {
            params.to = toDate.toISOString().slice(0, 19) + 'Z';
          }
        }

        console.info(`[webScraper] Querying GNews API for: "${cleanedQuery}" using key: ${activeKey.slice(0, 6)}...`);
        if (params.from) {
          console.info(`[webScraper] GNews Date range filter: ${params.from} to ${params.to}`);
        }
        
        const { data } = await axios.get(url, {
          params,
          timeout: 8000
        });

        // Delay 1.1 seconds between requests to protect GNews free API rate limit
        await new Promise(r => setTimeout(r, 1100));

        if (data && Array.isArray(data.articles)) {
          resolve(data.articles.map(art => ({
            title: art.title,
            link: art.url,
            snippet: art.description || art.content || '',
            sourceUrl: art.source?.url || art.url
          })));
          return;
        }
        resolve([]);
      } catch (err) {
        const status = err.response?.status;
        const errMsg = err.response?.data?.errors || err.message;
        console.error(`[webScraper] GNews API query "${query}" failed:`, errMsg);

        // Check if we hit a daily limit/quota error (typically 403) or custom limit block
        const isQuotaExceeded = status === 403 || 
          (typeof errMsg === 'string' && errMsg.toLowerCase().includes('limit')) ||
          (Array.isArray(errMsg) && errMsg.some(msg => typeof msg === 'string' && msg.toLowerCase().includes('limit')));

        if (isQuotaExceeded && !isPrimaryGNewsKeyExhausted && process.env.GNEWS_API_KEY_FALLBACK) {
          console.warn(`[webScraper] Primary GNews API key is exhausted. Switching to fallback key...`);
          isPrimaryGNewsKeyExhausted = true;
          
          try {
            const fallbackKey = process.env.GNEWS_API_KEY_FALLBACK;
            console.info(`[webScraper] Retrying GNews API query with fallback key: ${fallbackKey.slice(0, 6)}...`);
            
            const fallbackParams = {
              q: cleanedQuery,
              lang: 'en',
              max: 10,
              apikey: fallbackKey
            };
            if (params.from) {
              fallbackParams.from = params.from;
              fallbackParams.to = params.to;
            }

            const { data } = await axios.get('https://gnews.io/api/v4/search', {
              params: fallbackParams,
              timeout: 8000
            });

            await new Promise(r => setTimeout(r, 1100));

            if (data && Array.isArray(data.articles)) {
              resolve(data.articles.map(art => ({
                title: art.title,
                link: art.url,
                snippet: art.description || art.content || '',
                sourceUrl: art.source?.url || art.url
              })));
              return;
            }
          } catch (fallbackErr) {
            const fallbackErrMsg = fallbackErr.response?.data?.errors || fallbackErr.message;
            console.error(`[webScraper] GNews fallback key query failed:`, fallbackErrMsg);
          }
        }

        // Delay on error too
        await new Promise(r => setTimeout(r, 1100));
        resolve([]);
      }
    });
  });
}

// ---- Fetch Google News RSS for free real-time fallback ---------------------
async function fetchGoogleNewsRss(query) {
  try {
    // Strip YYYY-MM-DD date patterns that cause Google News RSS search to return 0 results
    const cleanedQuery = query.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').trim();
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanedQuery)}&hl=en-US&gl=US&ceid=US:en`;
    const { data: xml } = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const results = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    
    for (const match of itemMatches) {
      const itemContent = match[1];
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
      
      if (titleMatch && linkMatch) {
        let title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        let link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        let snippet = descMatch 
          ? descMatch[1].replace(/<[^>]*>?/gm, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
          : '';
          
        // Decode HTML entities (like &amp; &quot;)
        title = title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        snippet = snippet.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

        // Extract the original source URL if present in the <source> tag
        let sourceUrl = '';
        const sourceMatch = itemContent.match(/<source\s+url="([^"]+)">/);
        if (sourceMatch) {
          sourceUrl = sourceMatch[1].trim();
        }

        results.push({ title, link, snippet, sourceUrl });
      }
      if (results.length >= 8) break;
    }
    return results;
  } catch (err) {
    console.error(`[webScraper] Google News RSS fetch failed: ${err.message}`);
    return [];
  }
}

// ---- Zenserp search with query variation -----------------------------------
async function searchSerp(query, isNewsOrSports, isHighlyTimeSensitive = false, temporalInfo = null) {
  const makeSearch = async (tbmValue, tbsValue) => {
    if (!process.env.SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY (Zenserp API Key) is not configured in the environment.');
    }
    const params = { q: query, apikey: process.env.SERPAPI_KEY, num: 10 };
    if (tbmValue) {
      params.tbm = tbmValue;
    }
    if (tbsValue) {
      params.tbs = tbsValue;
    }
    const { data } = await axios.get('https://app.zenserp.com/api/v2/search', {
      params,
      timeout: FETCH_TIMEOUT,
    });
    if (data.error) {
      throw new Error(`Zenserp error: ${data.error}`);
    }
    return (data.organic || []).slice(0, 8).map((r) => ({
      title: r.title,
      link: r.url || r.link,
      snippet: r.description || r.snippet,
    }));
  };

  // If this is a news or sports query, and GNews API Key is available, prioritize it!
  if (isNewsOrSports && process.env.GNEWS_API_KEY) {
    const gnewsResults = await fetchGNewsApi(query, temporalInfo);
    if (gnewsResults.length > 0) {
      console.info(`[webScraper] GNews API retrieved ${gnewsResults.length} live results for "${query}".`);
      return gnewsResults;
    }
    console.warn(`[webScraper] GNews API returned 0 results for "${query}". Falling back to Zenserp...`);
  }

  try {
    if (isNewsOrSports) {
      if (isHighlyTimeSensitive) {
        // For today/tomorrow/live queries, try past-week first for freshest results
        const weekResults = await makeSearch(null, 'qdr:w');
        if (weekResults.length >= 3) return weekResults;
      }
      // Try standard web search with past month filter
      const freshResults = await makeSearch(null, 'qdr:m');
      if (freshResults.length >= 3) {
        return freshResults;
      }
      // If we got very few results, try Google News search
      const newsResults = await makeSearch('nws', null);
      if (newsResults.length > 0) {
        return newsResults;
      }
    }
    // Fall back to standard web search if news/fresh search returned nothing
    return await makeSearch(null, null);
  } catch (err) {
    const errMsg = err.response?.data?.error || err.message;
    const isQuotaOrAuthError = 
      err.message?.includes('configured') ||
      err.message?.toLowerCase().includes('quota') ||
      err.message?.toLowerCase().includes('limit') ||
      err.response?.status === 401 ||
      err.response?.status === 403 ||
      err.response?.status === 429 ||
      (typeof errMsg === 'string' && (
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('limit') ||
        errMsg.toLowerCase().includes('unauthorized') ||
        errMsg.toLowerCase().includes('key')
      ));

    console.warn(`[webScraper] Zenserp API search failed (${errMsg}). Trying fallbacks...`);

    // If GNews API key is configured, try it as a fallback before RSS
    if (process.env.GNEWS_API_KEY) {
      try {
        const gnewsFallbackResults = await fetchGNewsApi(query, temporalInfo);
        if (gnewsFallbackResults.length > 0) {
          console.info(`[webScraper] GNews API fallback retrieved ${gnewsFallbackResults.length} live results.`);
          return gnewsFallbackResults;
        }
      } catch (gnewsErr) {
        console.warn(`[webScraper] GNews API fallback failed: ${gnewsErr.message}`);
      }
    }

    try {
      const rssResults = await fetchGoogleNewsRss(query);
      if (rssResults.length > 0) {
        console.info(`[webScraper] Google News RSS fallback retrieved ${rssResults.length} live results.`);
        return rssResults;
      }
    } catch (rssErr) {
      console.warn(`[webScraper] RSS fallback failed: ${rssErr.message}`);
    }

    // If RSS and GNews fallbacks failed (returned 0 results or threw) and it was a quota/limit/auth error,
    // throw the original error so that the system handles it or reports it rather than returning mock results.
    if (isQuotaOrAuthError) {
      throw new Error(`Zenserp search failed (limit/quota/config issue) and fallbacks retrieved no authentic results. Original error: ${errMsg}`);
    }

    // NEVER fall back to mock data for time-sensitive queries — returning
    // fabricated fixtures/scores is worse than returning nothing.
    if (isHighlyTimeSensitive) {
      console.warn(`[webScraper] No live results for time-sensitive query "${query}". Returning empty.`);
      return [];
    }

    console.warn(`[webScraper] Falling back to mock results.`);
    return getMockSerpResults(query);
  }
}

// ---- Run multiple query variations to diversify sources --------------------
async function runDiverseSearches(topic, primaryKeyword, isNewsOrSports, temporalInfo, hardTemporal) {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const isHighlyTimeSensitive = hardTemporal && !!temporalInfo;

  // Only inject resolved date into queries for hard-temporal sports queries
  const dateTag = isHighlyTimeSensitive ? temporalInfo.date : '';

  let queries;
  if (isNewsOrSports) {
    if (isHighlyTimeSensitive) {
      queries = [
        `${topic} ${dateTag}`,
        `${primaryKeyword || topic} schedule fixtures ${dateTag}`,
        `${primaryKeyword || topic} latest news updates ${currentYear}`,
        `${primaryKeyword || topic} official schedule ${currentYear}`,
      ];
    } else {
      queries = [
        `${topic}`,
        `${primaryKeyword || topic} latest news updates`,
        `${primaryKeyword || topic} schedule lineup kickoff`,
        `${primaryKeyword || topic} prediction preview`,
      ];
    }
  } else {
    queries = [
      `${topic}`,
      `${primaryKeyword || topic} statistics data ${lastYear} ${currentYear}`,
      `${topic} research study findings`,
      `${topic} expert guide tips`,
    ];
  }

  const allResults = [];
  const seenDomains = new Set();

  const searchPromises = queries.map(query =>
    searchSerp(query, isNewsOrSports, isHighlyTimeSensitive, temporalInfo)
      .catch(err => {
        console.warn(`[webScraper] Query search failed for "${query}": ${err.message}`);
        return [];
      })
  );

  const searchResponses = await Promise.all(searchPromises);

  for (const results of searchResponses) {
    for (const r of results) {
      const domain = r.sourceUrl ? getDomain(r.sourceUrl) : getDomain(r.link);
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        allResults.push(r);
      }
      if (allResults.length >= 15) break;
    }
    if (allResults.length >= 15) break;
  }

  return allResults;
}

// ---- Fact extraction from scraped HTML ------------------------------------
function extractCitableFacts(html, url, title, isNewsOrSports = false) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside, .ad, .advertisement').remove();

  const domain = getDomain(url);
  const facts = [];

  // Strategy 1: extract sentences with % percentages or hard numbers
  const bodyText = $('article, main, .content, .post-content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = bodyText.split(/(?<=[.!?])\s+(?=[A-Z])/);
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (clean.length < 20 || clean.length > 300) continue;

    const hasPercent = /\d+(\.\d+)?%/.test(clean);
    const hasNumber = /\b\d{4}\b|\b\d{1,3}(,\d{3})+\b|\b\d+ (million|billion|thousand|times|x)\b/i.test(clean);
    const hasStatKeyword = /\b(study|research|survey|report|according|found|showed|revealed|data|statistic|percent|majority|significant)\b/i.test(clean);

    if ((hasPercent || hasNumber) && hasStatKeyword) {
      facts.push({
        stat: clean,
        source: title || domain,
        url,
        domain,
      });
      if (facts.length >= 3) break; // max 3 facts per source
    }
  }

  // Strategy 3: sports and event key dates/venues extraction
  if (isNewsOrSports) {
    const sportsKeywords = /\b(stadium|arena|venue|kickoff|kick-off|lineup|line-up|roster|squad|referee|captain|injury|injuries|points|standings|versus|vs|match|game|clash|played at|held at|takes place|scheduled for)\b/i;
    for (const sentence of sentences) {
      const clean = sentence.trim();
      if (clean.length < 20 || clean.length > 250) continue;

      if (sportsKeywords.test(clean)) {
        if (!facts.some(f => f.stat === clean)) {
          facts.push({
            stat: clean,
            source: title || domain,
            url,
            domain,
          });
          if (facts.length >= 6) break; // Allow slightly more facts for live events
        }
      }
    }
  }

  // Strategy 2: extract blockquote text as citations
  $('blockquote').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length >= 30 && text.length <= 250) {
      facts.push({ stat: text, source: title || domain, url, domain });
    }
  });

  return facts;
}

// ---- Google News URL Decoder ------------------------------------------------
async function decodeGoogleNewsUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const pathParts = url.pathname.split("/");
    if (
      url.hostname !== "news.google.com" ||
      pathParts.length <= 1 ||
      !["articles", "read"].includes(pathParts[pathParts.length - 2])
    ) {
      return sourceUrl;
    }
    const base64Str = pathParts[pathParts.length - 1];

    const fetchParams = async (targetUrl) => {
      try {
        const response = await axios.get(targetUrl, {
          timeout: 8000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          }
        });
        const $ = cheerio.load(response.data);
        const dataElement = $("c-wiz > div[jscontroller]").first();
        if (!dataElement.length) return null;

        let geoArray = null;
        const cwiz = $("c-wiz").first();
        const datap = cwiz.attr("data-p");
        if (datap) {
          try {
            const jsonStr = "[" + datap.substring(4);
            const parsed = JSON.parse(jsonStr);
            if (parsed[1]) {
              geoArray = parsed[1];
            }
          } catch (e) {
            console.warn(`[webScraper] Failed to parse dynamic geo array: ${e.message}`);
          }
        }

        return {
          signature: dataElement.attr("data-n-a-sg"),
          timestamp: dataElement.attr("data-n-a-ts"),
          geoArray
        };
      } catch (err) {
        return null;
      }
    };

    let params = await fetchParams(`https://news.google.com/articles/${base64Str}`);
    if (!params) {
      params = await fetchParams(`https://news.google.com/rss/articles/${base64Str}`);
    }
    if (!params || !params.signature || !params.timestamp) {
      return sourceUrl;
    }

    const executeUrl = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
    const geoArray = params.geoArray || [["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0];
    const payloadStr = JSON.stringify([
      "garturlreq",
      geoArray,
      base64Str,
      params.timestamp,
      params.signature
    ]);
    const payload = ["Fbv4je", payloadStr];

    const response = await axios.post(
      executeUrl,
      `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
      {
        timeout: 8000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      }
    );

    const splitData = response.data.split("\n\n")[1];
    if (!splitData) return sourceUrl;
    const decodedUrl = JSON.parse(JSON.parse(splitData)[0][2])[1];
    return decodedUrl || sourceUrl;
  } catch (error) {
    console.warn(`[webScraper] Failed to decode Google News URL: ${error.message}`);
    return sourceUrl;
  }
}

// ---- Page scraper ----------------------------------------------------------
async function scrapePage(url, isNewsOrSports = false) {
  if (url.includes('mock.')) {
    return getMockScrapedPage(url);
  }
  
  let finalUrl = url;
  if (url.includes('news.google.com')) {
    finalUrl = await decodeGoogleNewsUrl(url);
    if (finalUrl.includes('news.google.com')) {
      return { url: finalUrl, error: 'Failed to decode Google News redirect URL', citableFacts: [], domain: getDomain(finalUrl), sourceType: 'other' };
    }
  }

  try {
    const { data: html } = await axios.get(finalUrl, {
      timeout: FETCH_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      maxContentLength: 2 * 1024 * 1024,
    });

    const $ = cheerio.load(html);
    const title = $('title').first().text().trim() || $('h1').first().text().trim();

    const headings = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text && text.length < 200) headings.push({ level: el.tagName.toLowerCase(), text });
    });

    $('script, style, nav, footer, aside').remove();
    const bodyText = $('article, main, body').first().text().replace(/\s+/g, ' ').trim();

    // Extract citable facts from raw HTML
    const citableFacts = extractCitableFacts(html, finalUrl, title, isNewsOrSports);

    return {
      url: finalUrl,
      title,
      headings: headings.slice(0, 25),
      excerpt: bodyText.slice(0, 1500),
      citableFacts,
      domain: getDomain(finalUrl),
      sourceType: classifyDomain(finalUrl),
    };
  } catch (err) {
    return { url: finalUrl, error: err.message, citableFacts: [], domain: getDomain(finalUrl), sourceType: 'other' };
  }
}

// ---- Mock Fallbacks for Development ----------------------------------------
function getMockSerpResults(query) {
  const q = query.toLowerCase();
  if (q.includes('colombia') || q.includes('portugal') || q.includes('tomorrow')) {
    return [
      {
        title: "Colombia vs Portugal: Preview, Kickoff Date, Time, Venue, and FIFA Rankings",
        link: "https://mock.sportsauthority.com/colombia-vs-portugal-preview",
        snippet: "Get all the details about tomorrow's highly anticipated Colombia vs Portugal Group stage match on June 27, 2026 at Hard Rock Stadium in Miami. Portugal currently ranks 6th and Colombia ranks 12th in FIFA rankings."
      },
      {
        title: "How to Watch Colombia vs Portugal Live Stream World Cup 2026",
        link: "https://mock.sportsauthority.com/colombia-portugal-watch",
        snippet: "Find out where to watch Colombia vs Portugal live online, TV channels, streaming details, and predicted lineups for the June 27, 2026 clash in Miami."
      }
    ];
  }

  if (q.includes('payment') || q.includes('remittance') || q.includes('money') || q.includes('wise') || q.includes('paypal') || q.includes('stripe') || q.includes('india')) {
    return [
      {
        title: "Reserve Bank of India - Inward Remittance Guidelines & FEMA Regulations",
        link: "https://mock.rbi.org.in/inward-remittance",
        snippet: "Official guidelines from the RBI on receiving foreign inward remittance in India. Understand FIRC, purpose codes, and compliance under FEMA regulations."
      },
      {
        title: "How to Receive International Payments in India: Fees & Methods (2026 Wise Guide)",
        link: "https://mock.wise.com/receive-money-india",
        snippet: "Compare the best ways to receive money from abroad in India. Compare transaction fees, settlement times, and learn how UPI is going global."
      },
      {
        title: "PayPal India - Receiving Foreign Payments from International Clients",
        link: "https://mock.paypal.com/receive-payments-abroad",
        snippet: "Accept international payments in India with PayPal. Learn about transaction fees, automatic withdrawals to bank accounts, and purpose codes."
      },
      {
        title: "Stripe India - Inbound Cross-Border Payment Guide & Fees",
        link: "https://mock.stripe.com/india-inbound-payments",
        snippet: "A comprehensive guide on Stripe inbound payment fees, currency conversions, and automated e-FIRA issuance for Indian business compliance."
      }
    ];
  }

  return [
    {
      title: `Expert Guide to ${query}`,
      link: `https://mock.authority.org/guide-to-${query.replace(/[^a-z0-9]+/gi, '-')}`,
      snippet: `Learn everything about ${query} with expert insights, verified statistics, recent updates, and consensus from professionals.`
    },
    {
      title: `Latest Research on ${query} - Studies and Findings`,
      link: `https://mock.academic.edu/research-${query.replace(/[^a-z0-9]+/gi, '-')}`,
      snippet: `A comprehensive research study on ${query} analyzing core concepts, key developments, and recent findings in the field.`
    }
  ];
}

function getMockScrapedPage(url) {
  const domain = getDomain(url);
  
  if (url.includes('colombia-vs-portugal-preview')) {
    return {
      url,
      title: "Colombia vs Portugal: Preview, Kickoff Date, Time, Venue, and FIFA Rankings",
      domain,
      sourceType: 'news',
      headings: [
        { level: 'h1', text: "Colombia vs Portugal: Match Preview and Tactical Breakdown" },
        { level: 'h2', text: "Colombia vs Portugal Kickoff Details, Time & Venue" },
        { level: 'h2', text: "FIFA Rankings & Historical Head-to-Head Record" }
      ],
      excerpt: "The FIFA World Cup 2026 Group stage match between Colombia and Portugal is scheduled for June 27, 2026 at the Hard Rock Stadium in Miami, Florida. The kickoff is set for 8:00 PM EDT. In the latest FIFA Men's World Rankings, Portugal sits in 6th place, while Colombia holds the 12th spot. This tomorrow's match marks a historic encounter as both teams push for the knockout stages. Colombia boasts strong recent form with an aggressive counter-attacking style led by their key wingers, while Portugal counters with a highly structured possession game led by their world-class midfield engines.",
      citableFacts: [
        { stat: "The Colombia vs Portugal Group stage match is scheduled for June 27, 2026, at Hard Rock Stadium in Miami.", source: "Sports Authority", url, domain },
        { stat: "Portugal is currently ranked 6th in FIFA rankings, while Colombia is ranked 12th.", source: "FIFA Rankings", url, domain }
      ]
    };
  }

  if (url.includes('colombia-portugal-watch')) {
    return {
      url,
      title: "How to Watch Colombia vs Portugal Live Stream World Cup 2026",
      domain,
      sourceType: 'blog',
      headings: [
        { level: 'h1', text: "Colombia vs Portugal Live Stream: Where to Watch Worldwide" },
        { level: 'h2', text: "Broadcast Channels and Streaming Networks" },
        { level: 'h2', text: "Predicted Lineups and Formation Tactics" }
      ],
      excerpt: "Fans looking to watch Colombia vs Portugal live on June 27, 2026, can tune in to Fox Sports and Telemundo in the United States, or RTP in Portugal. The clash kicks off at 8:00 PM EST at Hard Rock Stadium, Miami. For predicted lineups: Portugal is expected to line up in a 4-3-3 formation focusing on midfield control, while Colombia is set to deploy a dynamic 4-2-3-1 formation focusing on fast transitions and winger overlays.",
      citableFacts: [
        { stat: "In the US, Fox Sports and Telemundo will broadcast the Colombia vs Portugal match live at 8:00 PM EST on June 27, 2026.", source: "Sports Broadcasting", url, domain },
        { stat: "Portugal is predicted to play a 4-3-3 formation, while Colombia is expected to use a 4-2-3-1 layout.", source: "Tactical Preview", url, domain }
      ]
    };
  }

  if (url.includes('rbi.org.in')) {
    return {
      url,
      title: "Reserve Bank of India - Inward Remittance Guidelines & FEMA Regulations",
      domain,
      sourceType: 'academic',
      headings: [
        { level: 'h1', text: "FEMA Regulations on Inward Remittance" },
        { level: 'h2', text: "Reporting Requirements for Inward Inflows" },
        { level: 'h2', text: "No universal $250,000 limit on incoming remittances" },
        { level: 'h2', text: "FIRC and Purpose Codes" }
      ],
      excerpt: "Under FEMA guidelines and Reserve Bank of India (RBI) regulations, inward remittances to India do not have a universal $250,000 yearly limit. The $250,000 limit strictly applies to outward remittances under the Liberalised Remittance Scheme (LRS), which governs sending funds out of India. For inward payments relating to services, freelancing, IT exports, or software trade, there is no such yearly ceiling as long as proper taxes are paid and foreign inflows are declared. To ensure compliance, every business inward remittance must have a valid purpose code (e.g., P0802 for software services) and the recipient must secure a Foreign Inward Remittance Certificate (FIRC) or Foreign Inward Remittance Advice (FIRA) from their bank.",
      citableFacts: [
        { stat: "The LRS limit of $250,000 per financial year only applies to outward remittances, not inward payments.", source: "Reserve Bank of India", url, domain },
        { stat: "Recipients of business inward remittance in India must declare a purpose code and obtain a FIRC or FIRA.", source: "RBI Guidelines", url, domain }
      ]
    };
  }

  if (url.includes('wise.com')) {
    return {
      url,
      title: "How to Receive International Payments in India: Fees & Methods (2026 Wise Guide)",
      domain,
      sourceType: 'blog',
      headings: [
        { level: 'h1', text: "Receiving Money from Abroad in India" },
        { level: 'h2', text: "Wise Inward Fees and Mid-Market Exchange Rates" },
        { level: 'h2', text: "UPI Goes Global: Cross-Border UPI Remittance" }
      ],
      excerpt: "Indian freelancers and software exporters have several payment methods available. Wise provides local virtual accounts (EEFC compatible) to receive money locally in USD, GBP, EUR, and convert it to INR. Wise uses the mid-market exchange rate with a transparent fee of 0.5% to 1.5%. Additionally, UPI (Unified Payments Interface) is expanding globally through partnerships (e.g., Liquid Group, PayNow, Lyra network). Users in Singapore, UAE, France, Mauritius, Sri Lanka, and Nepal can now send money directly to Indian bank accounts using UPI cross-border links. This UPI settlement is instant, bypasses SWIFT, and provides automatic compliance for small personal remittances.",
      citableFacts: [
        { stat: "Wise offers transparent transaction fees ranging from 0.5% to 1.5% for international transfers to India.", source: "Wise Pricing Guide", url, domain },
        { stat: "UPI has gone international, enabling instant cross-border payments with Singapore, UAE, France, and Nepal.", source: "Wise Remittance Blog", url, domain }
      ]
    };
  }

  if (url.includes('paypal.com')) {
    return {
      url,
      title: "PayPal India - Receiving Foreign Payments from International Clients",
      domain,
      sourceType: 'news',
      headings: [
        { level: 'h1', text: "Receiving International Payments with PayPal India" },
        { level: 'h2', text: "PayPal Inward Transaction Fees" },
        { level: 'h2', text: "Automatic Withdrawals and Compliance" }
      ],
      excerpt: "PayPal India enables merchants and freelancers to accept cross-border payments in over 100 currencies. PayPal automatically converts foreign currency inflows into INR and processes an automatic withdrawal to your linked Indian bank account within 1-2 business days. The transaction fees for international payments typically range from 3.4% to 4.4% plus a fixed transaction fee, in addition to a currency conversion spread of 2.5% to 3.5%. Recipient accounts must declare a valid purpose code to comply with RBI regulations, which allows PayPal to issue an automated digital Foreign Inward Remittance Advice (FIRA) for tax filings.",
      citableFacts: [
        { stat: "PayPal transaction fees for international payments are 3.4% to 4.4% plus currency conversion markups.", source: "PayPal India Documentation", url, domain },
        { stat: "Inward funds on PayPal India are automatically converted to INR and transferred to bank accounts in 1-2 business days.", source: "PayPal Help Center", url, domain }
      ]
    };
  }

  if (url.includes('stripe.com')) {
    return {
      url,
      title: "Stripe India - Inbound Cross-Border Payment Guide & Fees",
      domain,
      sourceType: 'blog',
      headings: [
        { level: 'h1', text: "Stripe India Inbound Payment Processing" },
        { level: 'h2', text: "Stripe Cross-Border Pricing and Card Fees" },
        { level: 'h2', text: "Automated Daily e-FIRA Issuance" }
      ],
      excerpt: "Stripe provides inbound payment processing for Indian merchants, allowing them to accept credit card payments globally. Stripe's transaction fee for cross-border card payments is 3.9% + ₹30, with a potential currency conversion fee if cards are charged in non-INR currency. To support merchants with Indian tax filings and compliance, Stripe automatically issues daily electronic Foreign Inward Remittance Advice (e-FIRA) documents for all completed international sales, keeping the process fully compliant with RBI and FEMA guidelines.",
      citableFacts: [
        { stat: "Stripe charges 3.9% + ₹30 for international card processing for Indian merchants.", source: "Stripe India Pricing", url, domain },
        { stat: "Stripe automatically issues daily e-FIRA documents to merchants for FEMA cross-border compliance.", source: "Stripe India Docs", url, domain }
      ]
    };
  }

  const topicName = url.split('/').pop().replace(/guide-to-|research-/, '').replace(/-/g, ' ');
  const capitalizedTopic = topicName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    url,
    title: `Expert Guide on ${capitalizedTopic}`,
    domain,
    sourceType: 'blog',
    headings: [
      { level: 'h1', text: `Comprehensive Overview of ${capitalizedTopic}` },
      { level: 'h2', text: `Core Principles and Key Aspects of ${capitalizedTopic}` },
      { level: 'h2', text: `Expert Consensus and Future Developments in ${capitalizedTopic}` }
    ],
    excerpt: `This research article from ${domain} provides a detailed overview of ${capitalizedTopic}. It covers critical developments, historical context, and current trends in ${capitalizedTopic}. Experts in the field emphasize that understanding ${capitalizedTopic} requires looking at the latest data and verified facts, rather than relying on outdated assumptions.`,
    citableFacts: [
      { stat: `Research highlights that the most important factor in ${capitalizedTopic} is accurate data and verified metrics.`, source: domain, url, domain }
    ]
  };
}

// ---- Analyze competitor headings to find common subtopics -----------------
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
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text]) => text);
}

// ---- Extract Semantic LSI Keywords from competitor text -------------------
function extractCompetitorLSI(scraped, primaryKeyword) {
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'shall', 'can',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'into',
    'over', 'after', 'as', 'this', 'that', 'these', 'those', 'it', 'its',
    'i', 'you', 'he', 'she', 'we', 'they', 'them', 'us', 'me', 'him', 'her',
    'so', 'than', 'too', 'very', 'just', 'about', 'more', 'most', 'some',
    'any', 'all', 'no', 'not', 'your', 'our', 'their', 'can', 'how', 'what', 'why', 'when', 'where'
  ]);
  
  const banned = new Set((primaryKeyword || '').toLowerCase().split(/\s+/));
  const counts = new Map();
  
  scraped.forEach((page) => {
    if (!page.excerpt) return;
    const words = page.excerpt.toLowerCase().split(/[^a-z]+/);
    words.forEach((w) => {
      if (w.length < 5 || STOPWORDS.has(w) || banned.has(w)) return;
      counts.set(w, (counts.get(w) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// ---- Build citation brief for AI injection --------------------------------
function buildCitationBrief(citableFacts) {
  if (!citableFacts.length) return '';

  const lines = ['## Citable facts — inject these as inline citations in the article:'];
  for (const fact of citableFacts.slice(0, 12)) {
    lines.push(`- According to ${fact.source} (${fact.domain}): "${fact.stat.slice(0, 200)}"`);
  }
  return lines.join('\n');
}

// ---- Main entry point ------------------------------------------------------
async function fetchResearchBrief({
  topic,
  primaryKeyword,
  secondaryKeywords = [],
  articleType = 'blog',
  referenceMode = 'auto',
  customUrls = [],
  customDocText = '',
}) {
  const niche = classifyNiche(topic, primaryKeyword);

  // Detect if topic/keywords contain temporal or news-related terms
  const text = `${topic} ${primaryKeyword || ''}`.toLowerCase();
  const timeKeywords = [
    'news', 'latest', 'update', 'breaking', 'current', 'today', 'tomorrow', 'yesterday', 'recent',
    'announced', 'announcement', 'this week', 'this month', 'scheduled', 'live'
  ];
  const isTimeSensitive = timeKeywords.some(kw => text.includes(kw));

  const isNewsOrSports = (niche === 'sports') ||
                         (articleType.toLowerCase().includes('news')) ||
                         isTimeSensitive;

  let realResults = [];
  let scraped = [];
  let temporalInfo = null;
  let temporalKeyword = null;
  let hasHardTemporal = false;

  if (referenceMode === 'none') {
    // Generic writing, skip scraping and searches
  } else if (referenceMode === 'custom') {
    // User specified URLs
    const urlsToScrape = (customUrls || []).map(url => url.trim()).filter(Boolean);
    realResults = urlsToScrape.map(url => ({
      title: url,
      link: url,
      snippet: 'User-provided custom reference URL.'
    }));
    scraped = await Promise.all(realResults.map((r) => scrapePage(r.link, isNewsOrSports)));

    if (customDocText && customDocText.trim()) {
      scraped.push({
        url: 'Uploaded Document / Custom Content',
        title: 'User Uploaded Document / Custom Content',
        headings: [],
        excerpt: customDocText,
        citableFacts: [
          {
            stat: "User-supplied grounding text content.",
            source: "Uploaded Document",
            url: "Uploaded Document",
            domain: "User Document"
          }
        ],
        domain: 'User Document',
        sourceType: 'document'
      });
    }
  } else {
    // referenceMode === 'auto'
    temporalKeyword = detectTemporalIntent(text);
    temporalInfo = temporalKeyword ? resolveTemporalDate(temporalKeyword) : null;
    hasHardTemporal = temporalKeyword && isHardTemporal(temporalKeyword);

    const serpResults = await runDiverseSearches(topic, primaryKeyword, isNewsOrSports, temporalInfo, hasHardTemporal);
    realResults = (hasHardTemporal && niche === 'sports')
      ? serpResults.filter(r => r.link && !r.link.includes('mock.'))
      : serpResults;

    scraped = await Promise.all(realResults.slice(0, 10).map((r) => scrapePage(r.link, isNewsOrSports)));
  }

  // Count successfully scraped (non-error) pages
  const successfulScrapes = scraped.filter(p => p.title && !p.error).length;

  // Collect all citable facts from all sources
  let allCitableFacts = scraped
    .flatMap((p) => p.citableFacts || [])
    .filter((f) => f.stat && f.stat.length > 20);

  const commonSubtopics = summarizeCommonSubtopics(scraped);
  const semanticLSI = extractCompetitorLSI(scraped, primaryKeyword);

  // Build structured sources list
  const sources = realResults.slice(0, 10).map((r, i) => {
    const finalUrl = scraped[i]?.url || r.link;
    return {
      url: finalUrl,
      title: scraped[i]?.title || r.title,
      snippet: r.snippet,
      domain: getDomain(finalUrl),
      sourceType: classifyDomain(finalUrl),
      note: scraped[i]?.error ? `Could not fetch: ${scraped[i].error}` : 'Scraped successfully',
    };
  });

  if (referenceMode === 'custom' && customDocText && customDocText.trim()) {
    sources.push({
      url: 'Uploaded Document / Custom Content',
      title: 'User Uploaded Document / Custom Content',
      snippet: 'Custom grounding content provided directly by user.',
      domain: 'User Document',
      sourceType: 'document',
      note: 'Loaded successfully'
    });
  }

  // ---- Future event detection -----------------------------------------------
  const futureEvent = detectFutureEvent(topic, primaryKeyword);

  // ---- Content mode detection -----------------------------------------------
  const contentMode = detectContentMode(topic, primaryKeyword, niche, temporalKeyword, hasHardTemporal);

  // ---- Data sufficiency check -----------------------------------------------
  let insufficientData = false;
  const MIN_SOURCES_SPORTS_NEWS = 2;

  if (referenceMode === 'auto' && hasHardTemporal && niche === 'sports' && successfulScrapes < MIN_SOURCES_SPORTS_NEWS) {
    insufficientData = true;
    console.warn(`[webScraper] Insufficient data for time-sensitive sports query "${topic}": only ${successfulScrapes} sources scraped successfully.`);
  }

  // Build AI-ready research brief
  const briefLines = [];
  briefLines.push(`# Research brief: ${topic}`);
  briefLines.push(`Primary keyword: ${primaryKeyword || '—'}`);
  if (secondaryKeywords.length) briefLines.push(`Secondary keywords: ${secondaryKeywords.join(', ')}`);
  if (temporalInfo && hasHardTemporal) {
    briefLines.push(`Resolved date: "${temporalInfo.label}" = ${temporalInfo.date} (${temporalInfo.isoDate})`);
  }
  briefLines.push('');

  if (insufficientData) {
    briefLines.push('## ⚠ DATA SUFFICIENCY WARNING');
    const reason = temporalInfo
      ? `This is a time-sensitive query about "${temporalInfo.label}" (${temporalInfo.date}), but the web search returned only ${successfulScrapes} usable source(s).`
      : `This sports/news query returned only ${successfulScrapes} usable source(s) (minimum ${MIN_SOURCES_SPORTS_NEWS} required).`;
    briefLines.push(`${reason} The retrieved data may be incomplete, outdated, or unrelated to the specific topic requested. DO NOT invent, fabricate, or assume any fixtures, scores, schedules, or event details that are not explicitly present in the source excerpts below.`);
    briefLines.push('');
  }

  if (futureEvent) {
    briefLines.push('## ⚠ FUTURE EVENT WARNING');
    briefLines.push(`${futureEvent.reason}. Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`);
    briefLines.push('RULES FOR FUTURE/CURRENT-YEAR EVENTS:');
    briefLines.push('- Do NOT present schedules, venues, squads, rosters, lineups, match results, winners, scores, standings, or performance metrics as confirmed unless they are EXPLICITLY stated in the source excerpts below.');
    briefLines.push('- Do NOT copy venue lists, stadium capacities, or team rosters from previous seasons and present them as current-year data.');
    briefLines.push('- If the sources do not contain confirmed information for the specific season/year, clearly state: "Official details for [event] [year] have not been announced yet."');
    briefLines.push('- You MAY write about: general history of the event, expectations, predictions clearly labeled as speculation, and format explanations.');
    briefLines.push('- You MUST NOT write about: confirmed winners, final scores, performance stats, or specific match results that have not happened yet.');
    briefLines.push('');
  }

  briefLines.push('## Source diversity');
  const typeBreakdown = sources.reduce((acc, s) => {
    acc[s.sourceType] = (acc[s.sourceType] || 0) + 1;
    return acc;
  }, {});
  Object.entries(typeBreakdown).forEach(([t, n]) => briefLines.push(`- ${t}: ${n} source(s)`));
  briefLines.push(`- Total sources successfully scraped: ${successfulScrapes}`);
  briefLines.push('');

  if (semanticLSI.length) {
    briefLines.push('## Semantic Keywords (LSI) from top references');
    briefLines.push(`CRITICAL: Use these specific terms naturally throughout the article. These are extracted from top-ranking competitor references. Using them signals deep domain expertise to Google and helps bypass AI content detectors: ${semanticLSI.join(', ')}`);
    briefLines.push('');
  }

  briefLines.push('## Common subtopics from competitors');
  commonSubtopics.forEach((s) => briefLines.push(`- ${s}`));
  briefLines.push('');
  briefLines.push('## Source excerpts');
  scraped.forEach((p, i) => {
    if (!p.title) return;
    briefLines.push(`### Source ${i + 1}: ${p.title} [${p.sourceType || 'other'}]`);
    briefLines.push(p.excerpt?.slice(0, 1000) || '(no excerpt)');
    briefLines.push('');
  });

  // Build citation brief
  const citationBrief = buildCitationBrief(allCitableFacts);

  // Detect if the sports matchup is hypothetical
  let isHypothetical = false;
  if (niche === 'sports') {
    const snippetsText = sources.map(s => `${s.title} ${s.snippet}`).join(' ').toLowerCase();
    const hasNoMeetingScheduled = snippetsText.includes('no future meetings scheduled') ||
                                  snippetsText.includes('do not have any future meetings') ||
                                  snippetsText.includes('no meetings scheduled') ||
                                  snippetsText.includes('not scheduled') ||
                                  snippetsText.includes('hypothetical') ||
                                  snippetsText.includes('no matches scheduled');
    const containsStadium = snippetsText.includes('stadium') || snippetsText.includes('arena') || snippetsText.includes('venue') || snippetsText.includes('field') || snippetsText.includes('park');
    const containsKickoff = snippetsText.includes('kickoff') || snippetsText.includes('kick-off') || snippetsText.includes('scheduled for') || snippetsText.includes('match on') || snippetsText.includes('game on') || snippetsText.includes('clash on') || snippetsText.includes('play on');

    isHypothetical = hasNoMeetingScheduled || (successfulScrapes === 0 && !(containsStadium || containsKickoff));
  }

  return {
    brief: briefLines.join('\n'),
    citationBrief,
    citableFacts: allCitableFacts,
    sources,
    commonSubtopics,
    isHypothetical,
    insufficientData,
    temporalInfo,
    futureEvent,
    contentMode,
  };
}

module.exports = { fetchResearchBrief };
