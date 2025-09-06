import bcrypt from 'bcrypt';
import UserModel from '../modals/User.model.js';
import { generateToken } from '../utils/jwt.js';

// Login Controller
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    // Find user by username (case insensitive)
    const user = await UserModel.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    }).populate('supervisor', 'firstName lastName username role');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from user object
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      teamProducts: user.teamProducts,
      teamArea: user.teamArea,
      area: user.area,
      city: user.city,
      district: user.district,
      supervisor: user.supervisor,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: userResponse,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id)
      .select('-password')
      .populate('supervisor', 'firstName lastName username role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.'
      });
    }

    // Get user with password
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await UserModel.findByIdAndUpdate(req.user._id, {
      password: hashedNewPassword
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

// Refresh token
export const refreshToken = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive.'
      });
    }

    const newToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};