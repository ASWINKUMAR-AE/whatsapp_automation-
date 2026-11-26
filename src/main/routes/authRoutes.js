import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { userService } from '../services/userService.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-automation-secret-key-change-in-production';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
        code: 'WEAK_PASSWORD'
      });
    }

    const existingUser = await userService.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    const user = await userService.createUser({
      name,
      email: email.toLowerCase(),
      password,
      isAdmin: false
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: userService.mapUser(user)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_FAILED'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await userService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await userService.comparePassword(user, password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const mappedUser = userService.mapUser(user);
    const token = jwt.sign(
      { userId: mappedUser.id, email: mappedUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: mappedUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_FAILED'
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    let user = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await userService.getUserById(decoded.userId);
      } catch (e) {}
    }

    if (!user) {
      user = await userService.getDefaultUser();
    }

    res.json({
      success: true,
      user: userService.mapUser(user)
    });
  } catch (error) {
    const defaultUser = await userService.getDefaultUser();
    res.json({
      success: true,
      user: userService.mapUser(defaultUser)
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    const user = await userService.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const mappedUser = userService.mapUser(user);
    const newToken = jwt.sign(
      { userId: mappedUser.id, email: mappedUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: newToken,
      user: mappedUser
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
});


router.post('/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ success: false, error: 'No token provided' });

    // Fetch user profile from google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!profileRes.ok) return res.status(400).json({ success: false, error: 'Invalid Google token' });
    
    const profile = await profileRes.json();
    const email = profile.email.toLowerCase();

    let user = await userService.getUserByEmail(email);
    if (!user) {
      // Auto register
      user = await userService.createUser({
        name: profile.name,
        email: email,
        password: Math.random().toString(36).slice(-10), // Random password for google users
        isAdmin: false
      });
    }

    const mappedUser = userService.mapUser(user);
    const jwtToken = jwt.sign(
      { userId: mappedUser.id, email: mappedUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Google Login successful',
      token: jwtToken,
      user: mappedUser
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ success: false, error: 'Google auth failed' });
  }
});

export default router;

