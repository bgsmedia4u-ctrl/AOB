import rateLimit from 'express-rate-limit';

// Rate limiter for the login endpoint
// Prevents brute-force password guessing: max 15 attempts per IP per 15-minute window
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' }
});
