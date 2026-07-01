/**
 * ContentForge AI - Express server entry point.
 *
 * Wires up:
 *   - Security middleware (helmet, cors, rate limiter)
 *   - JSON body parsing & request logging
 *   - Mongo connection (via ./config/db)
 *   - All API routes under /api/*
 *   - Centralized error handler
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

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

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.startsWith('http://localhost') ||
                        (process.env.NODE_ENV === 'production');
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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

// ---- Serve static assets in production -----------------------------------
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

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
