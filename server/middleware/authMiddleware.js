const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

/**
 * Verify the bearer JWT and attach the user document to req.user.
 * Used to protect any route that needs an authenticated user.
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401);
      throw new Error('User no longer exists');
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

module.exports = { protect };
