const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PLAN_LIMITS = {
  free: 9999999,
  pro: 100000,
  enterprise: 1000000,
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 6,
      select: false, // exclude from queries by default
    },
    googleId: { type: String, unique: true, sparse: true },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    wordsUsed: { type: Number, default: 0 },
    avatar: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

userSchema.virtual('wordsLimit').get(function () {
  return PLAN_LIMITS[this.plan] || PLAN_LIMITS.free;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
