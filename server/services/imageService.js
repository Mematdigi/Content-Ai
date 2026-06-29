/**
 * Image Service
 * -------------
 * Fetches real images from Unsplash (free) or Pexels (free) APIs
 * and replaces <!-- IMAGE: description --> placeholders in article content
 * with actual <img> tags that have proper alt text for SEO.
 *
 * Setup: Add one of these to your .env file:
 *   UNSPLASH_ACCESS_KEY=your_key    (get free at unsplash.com/developers)
 *   PEXELS_API_KEY=your_key         (get free at pexels.com/api)
 *
 * If no API key is configured, placeholders are left as-is.
 */

const axios = require('axios');

async function searchUnsplash(query, count = 1) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  try {
    const { data } = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: `Client-ID ${key}` },
      timeout: 8000,
    });

    return (data.results || []).map(img => ({
      url: `${img.urls.raw}&w=800&h=400&fit=crop&q=80`,
      alt: img.alt_description || query,
      credit: `Photo by ${img.user.name} on Unsplash`,
      creditUrl: img.user.links.html,
      width: 800,
      height: 400,
    }));
  } catch (err) {
    console.warn(`[imageService] Unsplash search failed: ${err.message}`);
    return [];
  }
}

async function searchPexels(query, count = 1) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  try {
    const { data } = await axios.get('https://api.pexels.com/v1/search', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: key },
      timeout: 8000,
    });

    return (data.photos || []).map(img => ({
      url: img.src.medium,
      alt: img.alt || query,
      credit: `Photo by ${img.photographer} on Pexels`,
      creditUrl: img.photographer_url,
      width: 800,
      height: 400,
    }));
  } catch (err) {
    console.warn(`[imageService] Pexels search failed: ${err.message}`);
    return [];
  }
}

async function searchImage(query) {
  // Try Unsplash first, fall back to Pexels
  let results = await searchUnsplash(query);
  if (results.length === 0) {
    results = await searchPexels(query);
  }
  return results[0] || null;
}

/**
 * Replace <!-- IMAGE: description --> placeholders with real <img> tags.
 * Returns { content, images } where images is an array for the DB.
 */
async function replaceImagePlaceholders(content) {
  const placeholderRegex = /<!--\s*IMAGE:\s*(.+?)\s*-->/g;
  const matches = [...content.matchAll(placeholderRegex)];

  if (matches.length === 0) return { content, images: [] };

  // No image API configured — leave placeholders
  if (!process.env.UNSPLASH_ACCESS_KEY && !process.env.PEXELS_API_KEY) {
    console.info('[imageService] No image API key configured. Skipping image replacement.');
    return { content, images: [] };
  }

  const images = [];
  let result = content;

  for (const match of matches) {
    const placeholder = match[0];
    const description = match[1].trim();

    const img = await searchImage(description);
    if (img) {
      const imgHtml = `<figure class="article-image">
  <img src="${img.url}" alt="${img.alt}" loading="lazy" width="${img.width}" height="${img.height}" />
  <figcaption>${img.credit}</figcaption>
</figure>`;

      result = result.replace(placeholder, imgHtml);
      images.push({ url: img.url, alt: img.alt, credit: img.credit });
    }
  }

  return { content: result, images };
}

module.exports = { replaceImagePlaceholders, searchImage };
