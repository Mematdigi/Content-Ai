const asyncHandler = require('express-async-handler');
const Article = require('../models/Article');

// @desc   Aggregate stats for the user dashboard
// @route  GET /api/dashboard/stats
// @access Private
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [agg, recent] = await Promise.all([
    Article.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalArticles: { $sum: 1 },
          avgSeoScore: { $avg: '$seoScore' },
          avgAiScore: { $avg: '$aiScoreAfter' },
          totalWords: { $sum: '$wordCount' },
        },
      },
    ]),
    Article.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title seoScore aiScoreAfter wordCount createdAt'),
  ]);

  const stats = agg[0] || {
    totalArticles: 0,
    avgSeoScore: 0,
    avgAiScore: 0,
    totalWords: 0,
  };

  res.json({
    totalArticles: stats.totalArticles,
    avgSeoScore: Math.round(stats.avgSeoScore || 0),
    avgAiScore: Math.round(stats.avgAiScore || 0),
    totalWords: stats.totalWords || 0,
    wordsUsed: req.user.wordsUsed,
    wordsLimit: req.user.wordsLimit,
    plan: req.user.plan,
    recent,
  });
});

module.exports = { getDashboardStats };
