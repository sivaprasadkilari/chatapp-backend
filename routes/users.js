const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../utils/authMiddleware');
const { body, param } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', userController.getCurrentUser);

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put('/me',
  [
    body('username').optional().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
    body('firstName').optional().isLength({ max: 50 }).withMessage('First name must be less than 50 characters'),
    body('lastName').optional().isLength({ max: 50 }).withMessage('Last name must be less than 50 characters'),
    body('bio').optional().isLength({ max: 200 }).withMessage('Bio must be less than 200 characters')
  ],
  userController.updateProfile
);

// @route   POST /api/users/upload-avatar
// @desc    Upload user avatar
// @access  Private
router.post('/upload-avatar', userController.uploadAvatar);

// @route   GET /api/users/search
// @desc    Search users by username or email
// @access  Private
router.get('/search', userController.searchUsers);

// @route   GET /api/users/:userId
// @desc    Get user profile by ID
// @access  Private
router.get('/:userId',
  [
    param('userId', 'Invalid user ID').isMongoId()
  ],
  userController.getUserById
);

// @route   POST /api/users/:userId/block
// @desc    Block a user
// @access  Private
router.post('/:userId/block',
  [
    param('userId', 'Invalid user ID').isMongoId()
  ],
  userController.blockUser
);

// @route   DELETE /api/users/:userId/block
// @desc    Unblock a user
// @access  Private
router.delete('/:userId/block',
  [
    param('userId', 'Invalid user ID').isMongoId()
  ],
  userController.unblockUser
);

// @route   GET /api/users/blocked
// @desc    Get blocked users list
// @access  Private
router.get('/blocked', userController.getBlockedUsers);

// @route   PUT /api/users/status
// @desc    Update user online status
// @access  Private
router.put('/status',
  [
    body('status').isIn(['online', 'offline', 'away']).withMessage('Invalid status')
  ],
  userController.updateStatus
);

// @route   GET /api/users/contacts
// @desc    Get user contacts/friends
// @access  Private
router.get('/contacts', userController.getContacts);

// @route   POST /api/users/contacts/:userId
// @desc    Add user to contacts
// @access  Private
router.post('/contacts/:userId',
  [
    param('userId', 'Invalid user ID').isMongoId()
  ],
  userController.addContact
);

// @route   DELETE /api/users/contacts/:userId
// @desc    Remove user from contacts
// @access  Private
router.delete('/contacts/:userId',
  [
    param('userId', 'Invalid user ID').isMongoId()
  ],
  userController.removeContact
);

module.exports = router;
