
const { keywordDensity } = require('./seoScorer');

function articleMentions(content, phrase) {
  return keywordDensity(content, phrase).count > 0;
}

function suggestSubtopics(content, commonSubtopics = []) {
  return commonSubtopics
    .filter((s) => !articleMentions(content, s.split(/[—:|]/)[0].trim()))
    .slice(0, 5)
    .map((s) => ({
      type: 'subtopic',
      text: `Add a section covering "${s}"`,
      detail: 'Multiple competitors cover this — including it improves topical depth.',
      applied: false,
    }));
}

function suggestStatistics(content) {
  const hasNumbers = /\b\d{1,3}(\.\d+)?\s*%/.test(content) || /\b(study|report|survey|research)\b/i.test(content);
  if (hasNumbers) return [];
  return [
    {
      type: 'statistic',
      text: 'Add at least one statistic or study citation',
      detail: 'Articles with credible numbers earn more trust and tend to rank higher.',
      applied: false,
    },
  ];
}

function suggestSchema(articleType, includeFaqs) {
  const out = [];
  if (includeFaqs) {
    out.push({
      type: 'schema',
      text: 'Add FAQPage schema markup',
      detail: 'Helps you appear in Google\'s "People also ask" rich results.',
      applied: false,
    });
  }
  if (articleType === 'how-to' || articleType === 'guide') {
    out.push({
      type: 'schema',
      text: 'Add HowTo schema markup',
      detail: 'Eligible for rich results showing the steps in search.',
      applied: false,
    });
  }
  out.push({
    type: 'schema',
    text: 'Add Article schema markup',
    detail: 'Provides structured author, date, and headline data to search engines.',
    applied: false,
  });
  return out;
}

function suggestExternalLinks(sources = []) {
  return sources.slice(0, 3).map((s) => ({
    type: 'external_link',
    text: `Cite "${s.title}"`,
    detail: s.url,
    applied: false,
  }));
}

function suggestImages(topic) {
  return [
    {
      type: 'image',
      text: `Add a hero image of "${topic}"`,
      detail: 'A strong opening visual increases engagement and time-on-page.',
      applied: false,
    },
    {
      type: 'image',
      text: 'Add an inline diagram or chart',
      detail: 'Helps readers grasp complex points and increases shareability.',
      applied: false,
    },
  ];
}

function buildSuggestions({ content, sources, commonSubtopics, articleType, includeFaqs, topic }) {
  return [
    ...suggestSubtopics(content, commonSubtopics),
    ...suggestStatistics(content),
    ...suggestExternalLinks(sources),
    ...suggestSchema(articleType, includeFaqs),
    ...suggestImages(topic),
  ];
}

module.exports = { buildSuggestions };
