const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * Shape we return to the client - never includes the password hash.
 */
const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  plan: user.plan,
  wordsUsed: user.wordsUsed,
  wordsLimit: user.wordsLimit,
  avatar: user.avatar,
  isVerified: user.isVerified,
});

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }

  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({ name, email, password });
  res.status(201).json({
    user: sanitize(user),
    token: generateToken(user._id),
  });
});

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    user: sanitize(user),
    token: generateToken(user._id),
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: sanitize(req.user) });
});

module.exports = { registerUser, loginUser, getMe, sanitize };
