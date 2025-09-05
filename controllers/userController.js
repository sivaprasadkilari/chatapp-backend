const User = require('../models/User');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const currentUserId = req.user.userId;

    // Build search criteria
    const searchCriteria = {
      _id: { $ne: currentUserId } // Exclude current user
    };

    if (search) {
      searchCriteria.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      searchCriteria.isOnline = status === 'online';
    }

    const users = await User.find(searchCriteria)
      .select('-password')
      .sort({ username: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formattedUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt
    }));

    const totalUsers = await User.countDocuments(searchCriteria);

    res.json({
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.userId;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters long' });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
    .select('-password')
    .limit(20)
    .sort({ username: 1 });

    const formattedUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error searching users' });
  }
};

// Get online users
exports.getOnlineUsers = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const onlineUsers = await User.find({
      _id: { $ne: currentUserId },
      isOnline: true
    })
    .select('-password')
    .sort({ lastSeen: -1 });

    const formattedUsers = onlineUsers.map(user => ({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ message: 'Server error fetching online users' });
  }
};

// Update online status
exports.updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isOnline = isOnline;
    user.lastSeen = new Date();
    await user.save();

    res.json({
      message: 'Online status updated successfully',
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Update online status error:', error);
    res.status(500).json({ message: 'Server error updating online status' });
  }
};

// Block/Unblock user
exports.toggleBlockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(currentUserId);
    const isBlocked = currentUser.blockedUsers.includes(userId);

    if (isBlocked) {
      // Unblock user
      currentUser.blockedUsers = currentUser.blockedUsers.filter(
        blockedId => blockedId.toString() !== userId
      );
      await currentUser.save();
      res.json({ message: 'User unblocked successfully', isBlocked: false });
    } else {
      // Block user
      currentUser.blockedUsers.push(userId);
      await currentUser.save();
      res.json({ message: 'User blocked successfully', isBlocked: true });
    }
  } catch (error) {
    console.error('Toggle block user error:', error);
    res.status(500).json({ message: 'Server error blocking/unblocking user' });
  }
};

// Get blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const currentUser = await User.findById(currentUserId)
      .populate('blockedUsers', 'username avatar email');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const blockedUsers = currentUser.blockedUsers.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar
    }));

    res.json({ blockedUsers });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Server error fetching blocked users' });
  }
};

// Check if user is blocked
exports.checkBlocked = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isBlockedByMe = currentUser.blockedUsers.includes(userId);
    const isBlockingMe = targetUser.blockedUsers.includes(currentUserId);

    res.json({
      isBlockedByMe,
      isBlockingMe,
      canMessage: !isBlockedByMe && !isBlockingMe
    });
  } catch (error) {
    console.error('Check blocked error:', error);
    res.status(500).json({ message: 'Server error checking block status' });
  }
};

// Update user avatar
exports.updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    const userId = req.user.userId;

    if (!avatar) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Avatar updated successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ message: 'Server error updating avatar' });
  }
};

// Delete user account
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Delete user and related data
    await User.findByIdAndDelete(userId);
    
    // Note: In a production app, you might want to:
    // - Delete related messages
    // - Handle cleanup of references in other collections
    // - Send confirmation email
    // - Log the deletion for audit purposes

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get message statistics
    const Message = require('../models/Message');
    
    const messagesSent = await Message.countDocuments({ sender: userId });
    const messagesReceived = await Message.countDocuments({ recipient: userId });
    const unreadMessages = await Message.countDocuments({ 
      recipient: userId, 
      status: { $ne: 'read' } 
    });

    // Get conversation count
    const conversations = await Message.distinct('recipient', { sender: userId });
    const conversationsAsRecipient = await Message.distinct('sender', { recipient: userId });
    const uniqueConversations = new Set([...conversations, ...conversationsAsRecipient]);
    const conversationCount = uniqueConversations.size;

    // Get user info
    const user = await User.findById(userId).select('-password');
    const daysSinceJoined = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));

    res.json({
      stats: {
        messagesSent,
        messagesReceived,
        unreadMessages,
        conversationCount,
        daysSinceJoined,
        joinDate: user.createdAt,
        lastSeen: user.lastSeen,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error fetching user statistics' });
  }
};
