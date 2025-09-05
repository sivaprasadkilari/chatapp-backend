const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../utils/authMiddleware');
const { body, validationResult } = require('express-validator');

// Validation middleware
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters long and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const validateProfileUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters long and contain only letters, numbers, and underscores'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

// Error handling middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Public routes (no authentication required)
router.post('/register', validateRegistration, handleValidationErrors, authController.register);
router.post('/login', validateLogin, handleValidationErrors, authController.login);

// Protected routes (authentication required)
router.use(authMiddleware);

// User profile routes
router.get('/profile', authController.getProfile);
router.put('/profile', validateProfileUpdate, handleValidationErrors, authController.updateProfile);

// Authentication management
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/change-password', validatePasswordChange, handleValidationErrors, authController.changePassword);

// Rate limiting for sensitive operations
const rateLimit = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.ceil(15 * 60) // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password changes per hour
  message: {
    message: 'Too many password change attempts, please try again later.',
    retryAfter: Math.ceil(60 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Apply rate limiting to sensitive routes
router.post('/register', authRateLimit);
router.post('/login', authRateLimit);
router.post('/change-password', passwordChangeRateLimit);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Authentication Service'
  });
});

module.exports = router;
