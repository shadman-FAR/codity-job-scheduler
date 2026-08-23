import bcrypt from 'bcryptjs';
import prisma from '../utils/prismaClient.js';
import { generateToken } from '../utils/generateToken.js';

const SALT_ROUNDS = 10;

/**
 * Registers a new user.
 * - Hashes the password before storing (never store plain text)
 * - Creates a default personal Organization for the user
 * - Returns the user (without password) and a JWT
 */
export async function registerUser({ email, password, name }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
   if (existingUser) {
    const error = new Error('A user with this email already exists');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      organizations: {
        create: {
          role: 'OWNER',
          organization: {
            create: { name: `${name}'s Organization` },
          },
        },
      },
    },
  });

  const token = generateToken(user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}

/**
 * Logs in an existing user.
 * - Verifies email exists
 * - Compares submitted password against stored bcrypt hash
 * - Returns the user (without password) and a JWT
 */
export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
        const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const token = generateToken(user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}

/**
 * Fetches the currently authenticated user's profile.
 */
export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

    if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return user;
}