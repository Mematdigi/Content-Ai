
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const fs = require('fs');
const axios = require('axios');
const Article = require('./models/Article');

const authRoutes = require('./routes/authRoutes');
const articleRoutes = require('./routes/articleRoutes');
const toolsRoutes = require('./routes/toolsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// ---- Database ------------------------------------------------------------
connectDB();

// ---- Core middleware ----------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limit only the AI-heavy endpoints
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' },
});

// ---- Health ------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ContentForge AI',
    time: new Date().toISOString(),
  });
});

// ---- Routes ------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/articles', aiLimiter, articleRoutes);
app.use('/api/tools', aiLimiter, toolsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ---- Serve static assets in production OR proxy to Vite in development ----
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
} else {
  // In development, proxy assets/scripts (non-page requests) to Vite dev server
  app.get('*', async (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    // A page request is a route request (e.g. /, /dashboard, /articles/id) that has no file extension
    const isHtmlPage = !req.path.includes('.') && 
                       !req.path.startsWith('/@') && 
                       !req.path.startsWith('/node_modules') && 
                       !req.path.startsWith('/src');

    if (!isHtmlPage) {
      try {
        const response = await axios({
          method: req.method,
          url: `http://localhost:5173${req.originalUrl}`,
          responseType: 'stream',
        });
        response.data.pipe(res);
        return;
      } catch (err) {
        return next();
      }
    }
    next();
  });
}

// Common catch-all handler for dynamic SEO metadata injection
app.get('*', async (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }

  let html = '';

  if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    const clientBuildPath = path.join(__dirname, '../client/dist');
    const indexPath = path.join(clientBuildPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send('Frontend build not found');
    }
    html = fs.readFileSync(indexPath, 'utf8');
  } else {
    // In development, fetch the index.html template from Vite dev server on port 5173
    try {
      const viteRes = await axios.get('http://localhost:5173/');
      html = viteRes.data;
    } catch (err) {
      return res.status(500).send('Vite dev server is not running on port 5173. Please start it to use development SEO rendering.');
    }
  }

  // Check if request is for a public article: /articles/:id (24 char hex MongoDB ID)
  const articleMatch = req.path.match(/^\/articles\/([a-fA-F0-9]{24})\/?$/);

  if (articleMatch) {
    const articleId = articleMatch[1];
    try {
      const article = await Article.findById(articleId);
      if (article) {
        const title = article.metaTitle || article.title;
        const desc = article.metaDescription || `Read "${article.title}" on ContentForge AI.`;
        const image = (article.images && article.images[0] && article.images[0].url) || '/favicon.svg';

        html = html
          .replace(/__META_TITLE__/g, title)
          .replace(/__META_DESCRIPTION__/g, desc)
          .replace(/__META_IMAGE__/g, image);

        const cleanSnippet = (article.content || '')
          .replace(/[#*`_>\[\]()|]/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 1000)
          .trim();

        const initialBodyHtml = `
          <div id="root">
            <article style="max-width: 800px; margin: 0 auto; padding: 2rem; font-family: sans-serif; line-height: 1.6;">
              <h1>${article.title}</h1>
              <p style="color: #666; font-size: 0.9rem;">
                Published on ${new Date(article.createdAt).toDateString()} • ${article.wordCount} words
              </p>
              ${article.images && article.images[0] ? `<img src="${article.images[0].url}" alt="${article.images[0].alt || ''}" style="width:100%; max-height:400px; object-fit:cover; border-radius:12px; margin-bottom:1.5rem;" />` : ''}
              <div style="font-size: 1.1rem; color: #333;">${cleanSnippet}...</div>
            </article>
          </div>
        `;
        html = html.replace('<div id="root"></div>', initialBodyHtml);
        return res.send(html);
      }
    } catch (err) {
      // Log fallback
    }
  }

  // Default template replacements
  html = html
    .replace(/__META_TITLE__/g, 'ContentForge AI')
    .replace(/__META_DESCRIPTION__/g, 'ContentForge AI - generate SEO-optimized, human-sounding articles with a multi-model AI pipeline')
    .replace(/__META_IMAGE__/g, '/favicon.svg');

  res.send(html);
});

// ---- Error handling -----------------------------------------------------
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `🚀 ContentForge API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
  );
});
