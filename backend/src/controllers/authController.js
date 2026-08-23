import { registerUser, loginUser, getCurrentUser } from '../services/authService.js';

export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'email, password, and name are required' },
      });
    }

    const result = await registerUser({ email, password, name });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'email and password are required' },
      });
    }

    const result = await loginUser({ email, password });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getCurrentUser(req.userId);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}