import { PrismaClient as ReportsPrismaClient } from '@prisma/client'

declare global {
  // Extend the NodeJS Global interface to include __reportsDb
  var __reportsDb: ReportsPrismaClient | undefined;
}

const reportsDb = globalThis.__reportsDb || new ReportsPrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__reportsDb = reportsDb;
}

export default reportsDb;