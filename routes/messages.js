const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../utils/authMiddleware');
const { body } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post('/',
  [
    body('recipientId', 'Recipient ID is required').notEmpty(),
    body('content', 'Message content is required').notEmpty().isLength({ max: 1000 }),
    body('messageType').optional().isIn(['text', 'image', 'file']).withMessage('Invalid message type')
  ],
  messageController.sendMessage
);

// @route   GET /api/messages/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', messageController.getConversations);

// @route   GET /api/messages/conversation/:userId
// @desc    Get messages between current user and specific user
// @access  Private
router.get('/conversation/:userId', messageController.getConversationMessages);

// @route   PUT /api/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/:messageId/read', messageController.markAsRead);

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', messageController.deleteMessage);

// @route   GET /api/messages/unread/count
// @desc    Get unread messages count
// @access  Private
router.get('/unread/count', messageController.getUnreadCount);

// @route   POST /api/messages/typing
// @desc    Send typing indicator
// @access  Private
router.post('/typing',
  [
    body('recipientId', 'Recipient ID is required').notEmpty(),
    body('isTyping', 'Typing status is required').isBoolean()
  ],
  messageController.sendTypingIndicator
);

module.exports = router;
