const express = require('express');
const { body } = require('express-validator');
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 chars'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
  ],
  registerUser
);

router.post('/login', loginUser);
router.get('/me', protect, getMe);

module.exports = router;
