import jwt from 'jsonwebtoken';

/**
 * Creates a signed JWT containing the user's ID.
 * Expires in 7 days — after that, the user must log in again.
 */
export function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}