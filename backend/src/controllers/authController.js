const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { email, password, fullName, walletAddress } = req.body;
    // Mandate: Never allow passing role during registration
    const result = await authService.registerUser({ email, password, fullName, walletAddress });
    res.status(201).json({
      success: true,
      message: 'User account registered successfully.',
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: 'RegistrationError',
      message: err.message
    });
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });
    res.status(200).json({
      success: true,
      message: 'Authenticated successfully.',
      data: result
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'AuthenticationError',
      message: err.message
    });
  }
};

const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user
  });
};

module.exports = {
  register,
  login,
  getMe
};
