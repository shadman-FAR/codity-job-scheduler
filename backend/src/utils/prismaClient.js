import { PrismaClient } from '@prisma/client';
/**
 * Single shared Prisma Client instance for the whole app.
 * Creating multiple instances can exhaust database connections —
 * this pattern ensures we only ever have one.
 */
const prisma = new PrismaClient();

export default prisma;