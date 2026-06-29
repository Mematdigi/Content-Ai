/**
 * Internal Linking Service
 * ------------------------
 * After article generation, searches existing articles in the database
 * and inserts 2-3 internal links to related content. This is critical
 * for Google crawling and page authority distribution.
 *
 * How it works:
 *   1. Finds published articles by the same user with related keywords
 *   2. Picks the 2-3 most relevant ones
 *   3. Appends an "Also Read" section before the FAQ
 */

const Article = require('../models/Article');

async function findRelatedArticles(userId, currentArticleKeyword, excludeTitle, limit = 3) {
  if (!currentArticleKeyword) return [];

  try {
    const keywords = currentArticleKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) return [];

    const searchPattern = keywords.join('|');

    const related = await Article.find({
      user: userId,
      status: 'completed',
      title: {
        $regex: searchPattern,
        $options: 'i',
        $ne: excludeTitle,
      },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title primaryKeyword _id');

    return related.map(a => ({
      id: a._id,
      title: a.title,
      keyword: a.primaryKeyword,
    }));
  } catch (err) {
    console.warn(`[internalLinker] Failed to find related articles: ${err.message}`);
    return [];
  }
}

function insertInternalLinks(content, relatedArticles, siteBaseUrl) {
  if (!relatedArticles.length) return content;

  const base = (siteBaseUrl || '').replace(/\/+$/, '');
  const linksSection = [
    '',
    '## Also Read',
    '',
    ...relatedArticles.map(a => {
      const url = base ? `${base}/article/${a.id}` : `/article/${a.id}`;
      return `- [${a.title}](${url})`;
    }),
    '',
  ].join('\n');

  // Insert before FAQ section if it exists, otherwise before Sources
  const faqMatch = content.match(/^(#{1,3}\s+.*FAQ)/im);
  const sourcesMatch = content.match(/^(#{1,3}\s+.*Sources)/im);

  if (faqMatch) {
    return content.replace(faqMatch[0], linksSection + '\n' + faqMatch[0]);
  } else if (sourcesMatch) {
    return content.replace(sourcesMatch[0], linksSection + '\n' + sourcesMatch[0]);
  }

  return content + '\n' + linksSection;
}

module.exports = { findRelatedArticles, insertInternalLinks };
