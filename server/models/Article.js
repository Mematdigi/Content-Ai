const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    url: String,
    title: String,
    snippet: String,
    note: String,
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['subtopic', 'statistic', 'internal_link', 'external_link', 'image', 'schema'],
    },
    text: String,
    detail: String,
    applied: { type: Boolean, default: false },
  },
  { _id: false }
);

const seoReportSchema = new mongoose.Schema(
  {
    overall: Number,
    keywordDensity: mongoose.Schema.Types.Mixed,
    readability: Number,
    headingStructure: { valid: Boolean, issues: [String] },
    metaTitle: { value: String, length: Number, ok: Boolean },
    metaDescription: { value: String, length: Number, ok: Boolean },
    suggestions: [String],
  },
  { _id: false }
);

const articleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    metaTitle: String,
    metaDescription: String,
    content: { type: String, required: true },
    outline: [{ heading: String, level: Number, summary: String }],

    // Inputs
    primaryKeyword: String,
    secondaryKeywords: [String],
    tone: { type: String, default: 'professional' },
    audience: String,
    language: { type: String, default: 'English' },
    articleType: { type: String, default: 'blog' },
    pointOfView: { type: String, default: 'third' },
    targetWordCount: Number,
    includeFaqs: Boolean,
    includeImages: Boolean,

    // Outputs
    wordCount: Number,
    readingTimeMinutes: Number,
    seoScore: Number,
    seoReport: seoReportSchema,
    aiScoreBefore: Number,
    aiScoreAfter: Number,

    sources: [sourceSchema],
    suggestions: [suggestionSchema],
    images: [{ url: String, alt: String, credit: String }],
    pipelineSteps: [
      {
        step: String,
        model: String,
        durationMs: Number,
        status: { type: String, enum: ['ok', 'fallback', 'error'] },
      },
    ],

    status: {
      type: String,
      enum: ['draft', 'completed', 'archived'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

articleSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
