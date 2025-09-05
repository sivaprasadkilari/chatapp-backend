const Message = require('../models/Message');
const User = require('../models/User');

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, messageType } = req.body;
    const senderId = req.user.userId;

    // Validate recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Create new message
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content,
      messageType: messageType || 'text',
      timestamp: new Date()
    });

    await message.save();

    // Populate sender and recipient details for response
    await message.populate('sender', 'username avatar');
    await message.populate('recipient', 'username avatar');

    res.status(201).json({
      message: 'Message sent successfully',
      data: {
        id: message._id,
        content: message.content,
        messageType: message.messageType,
        timestamp: message.timestamp,
        sender: {
          id: message.sender._id,
          username: message.sender.username,
          avatar: message.sender.avatar
        },
        recipient: {
          id: message.recipient._id,
          username: message.recipient.username,
          avatar: message.recipient.avatar
        },
        status: message.status,
        readAt: message.readAt
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// Get conversation between two users
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find messages between current user and specified user
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Mark messages as read when fetching conversation
    await Message.updateMany(
      {
        sender: userId,
        recipient: currentUserId,
        status: { $ne: 'read' }
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );

    const formattedMessages = messages.reverse().map(message => ({
      id: message._id,
      content: message.content,
      messageType: message.messageType,
      timestamp: message.timestamp,
      sender: {
        id: message.sender._id,
        username: message.sender.username,
        avatar: message.sender.avatar
      },
      recipient: {
        id: message.recipient._id,
        username: message.recipient.username,
        avatar: message.recipient.avatar
      },
      status: message.status,
      readAt: message.readAt
    }));

    res.json({
      messages: formattedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Message.countDocuments({
          $or: [
            { sender: currentUserId, recipient: userId },
            { sender: userId, recipient: currentUserId }
          ]
        })
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error fetching conversation' });
  }
};

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    // Get all unique conversations
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserId },
            { recipient: currentUserId }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$sender', currentUserId] },
              then: '$recipient',
              else: '$sender'
            }
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$recipient', currentUserId] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      {
        $unwind: '$otherUser'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'lastMessageSender'
        }
      },
      {
        $unwind: '$lastMessageSender'
      },
      {
        $project: {
          otherUser: {
            id: '$otherUser._id',
            username: '$otherUser.username',
            avatar: '$otherUser.avatar',
            isOnline: '$otherUser.isOnline',
            lastSeen: '$otherUser.lastSeen'
          },
          lastMessage: {
            id: '$lastMessage._id',
            content: '$lastMessage.content',
            messageType: '$lastMessage.messageType',
            timestamp: '$lastMessage.timestamp',
            sender: {
              id: '$lastMessageSender._id',
              username: '$lastMessageSender.username'
            },
            status: '$lastMessage.status'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      }
    ]);

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error fetching conversations' });
  }
};

// Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only recipient can mark message as read
    if (message.recipient.toString() !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized to mark this message as read' });
    }

    message.status = 'read';
    message.readAt = new Date();
    await message.save();

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error marking message as read' });
  }
};

// Mark all messages in conversation as read
exports.markConversationAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    await Message.updateMany(
      {
        sender: userId,
        recipient: currentUserId,
        status: { $ne: 'read' }
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );

    res.json({ message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Mark conversation as read error:', error);
    res.status(500).json({ message: 'Server error marking conversation as read' });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can delete message
    if (message.sender.toString() !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error deleting message' });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const unreadCount = await Message.countDocuments({
      recipient: currentUserId,
      status: { $ne: 'read' }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
};

// Search messages
exports.searchMessages = async (req, res) => {
  try {
    const { query, userId } = req.query;
    const currentUserId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchCriteria = {
      content: { $regex: query, $options: 'i' },
      $or: [
        { sender: currentUserId },
        { recipient: currentUserId }
      ]
    };

    // If userId is provided, search within specific conversation
    if (userId) {
      searchCriteria.$or = [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ];
    }

    const messages = await Message.find(searchCriteria)
      .populate('sender', 'username avatar')
      .populate('recipient', 'username avatar')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formattedMessages = messages.map(message => ({
      id: message._id,
      content: message.content,
      messageType: message.messageType,
      timestamp: message.timestamp,
      sender: {
        id: message.sender._id,
        username: message.sender.username,
        avatar: message.sender.avatar
      },
      recipient: {
        id: message.recipient._id,
        username: message.recipient.username,
        avatar: message.recipient.avatar
      },
      status: message.status,
      readAt: message.readAt
    }));

    res.json({
      messages: formattedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Message.countDocuments(searchCriteria)
      }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ message: 'Server error searching messages' });
  }
};
