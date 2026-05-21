const jwt = require('jsonwebtoken');

/**
 * Sign a JWT for the given user id.
 * Throws at startup time if JWT_SECRET is missing.
 */
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateToken;
