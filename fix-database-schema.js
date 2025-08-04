#!/usr/bin/env node

/**
 * Database Schema Fix Script
 * 
 * This script fixes the schema inconsistencies that are causing 500 errors
 * in your deployed backend.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting Database Schema Fix...\n');

// Step 1: Backup current schema
console.log('1️⃣ Creating schema backup...');
try {
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
  const backupPath = path.join(__dirname, 'prisma', 'schema.prisma.backup');
  fs.copyFileSync(schemaPath, backupPath);
  console.log('✅ Schema backed up to schema.prisma.backup\n');
} catch (error) {
  console.error('❌ Failed to backup schema:', error.message);
  process.exit(1);
}

// Step 2: Fix the schema ID type consistency
console.log('2️⃣ Fixing schema ID type consistency...');
const fixedSchema = `
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider      = "prisma-client-js"
  binaryTargets = env("PRISMA_BUILD")
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    String   @id @default(cuid())
  email String   @unique
  name  String?
  role  UserRole @default(RESEARCHER)

  // Enhanced user fields from original schema
  username              String?   @unique
  firstName             String?
  lastName              String?
  passwordHash          String?
  isActive              Boolean   @default(true)
  termsAccepted         Boolean   @default(false)
  termsAcceptedAt       DateTime?
  // Authentication & Session Management
  lastLogin             DateTime?
  refreshTokenHash      String?
  refreshTokenExpiresAt DateTime?

  // Organization relationship
  organization Organization?

  // New relations from original schema
  auditLogs     AuditLog[]     @relation("UserAuditLogs")
  performedBy   AuditLog[]     @relation("PerformedByUser")
  sessions      Session[]
  refreshTokens RefreshToken[]

  reports Report[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Organization {
  id          String  @id @default(cuid())
  name        String
  description String?
  website     String?

  // Enhanced organization fields from original schema
  address  String?
  phone    String?
  logo     String? // URL to logo image
  industry String?
  size     Int? // Number of employees
  verified Boolean @default(false)

  // User relationship (one-to-one)
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Programs relationship
  programs Program[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("organizations")
}

model Program {
  id                   String        @id @default(cuid())
  title                String
  description          String
  websiteName          String
  websiteUrls          String[]
  scope                String[]
  outOfScope           String?
  rewards              Json
  submissionGuidelines String?
  disclosurePolicy     String?
  startDate            DateTime?
  endDate              DateTime?
  reports              Report[]
  status               ProgramStatus @default(DRAFT)

  // Organization relationship
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Submissions relationship
  submissions Submission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("programs")
}

model Submission {
  id          String           @id @default(cuid())
  title       String
  description String
  severity    Severity
  status      SubmissionStatus @default(PENDING)
  reports     Report[]

  // Program relationship
  programId String
  program   Program @relation(fields: [programId], references: [id], onDelete: Cascade)

  // Researcher info (can be expanded to User model later)
  researcherEmail String
  researcherName  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("submissions")
}

// New models from original schema for enhanced functionality

model AuditLog {
  id         String      @id @default(cuid())
  action     AuditAction
  entityType String // e.g., "User", "Program", "Organization", etc.
  entityId   String // ID of the affected record
  oldData    Json? // Previous state (if applicable)
  newData    Json? // New state (if applicable)

  performedById String
  performedBy   User   @relation("PerformedByUser", fields: [performedById], references: [id])

  userId String?
  user   User?   @relation("UserAuditLogs", fields: [userId], references: [id])

  createdAt DateTime @default(now())

  @@index([entityType, entityId])
  @@index([performedById])
  @@index([userId])
  @@map("audit_logs")
}

model Session {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  ipAddress     String?
  userAgent     String
  deviceType    String?
  deviceOS      String?
  deviceBrowser String?
  location      String?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  lastSeen      DateTime       @updatedAt
  expiresAt     DateTime
  refreshTokens RefreshToken[]

  @@map("sessions")
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@map("refresh_tokens")
}

model Otp {
  id        String   @id @default(cuid())
  email     String
  code      String
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@map("otps")
}

// Enums
enum UserRole {
  RESEARCHER
  ORGANIZATION
  ADMIN
}

enum ProgramStatus {
  DRAFT
  ACTIVE
  PAUSED
  CLOSED
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum SubmissionStatus {
  PENDING
  ACCEPTED
  REJECTED
  RESOLVED
  DUPLICATE
}

enum AuditAction {
  CREATED
  UPDATED
  DELETED
  LOGIN
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  PASSWORD_CHANGED
  ROLE_CHANGED
  ACCOUNT_DISABLED
  ACCOUNT_ENABLED
  TOKEN_REFRESH
  REGISTER
}

model Report {
  id          String       @id @default(cuid())
  title       String
  description String?
  content     String
  status      ReportStatus @default(DRAFT)
  type        ReportType   @default(GENERAL)

  // Link to existing User model
  authorId String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // Optional: Link to programs if reports are program-specific
  programId String?
  program   Program? @relation(fields: [programId], references: [id], onDelete: SetNull)

  // Optional: Link to submissions if reports are submission-related
  submissionId String?
  submission   Submission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)

  tags     String[] // Array of tags for categorization
  priority Priority @default(MEDIUM)
  isPublic Boolean  @default(false)

  attachments Json? // Store file URLs/paths as JSON
  metadata    Json?

  // Timestamps
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  publishedAt DateTime?

  @@index([authorId])
  @@index([programId])
  @@index([submissionId])
  @@index([status])
  @@index([type])
  @@map("reports")
}

enum ReportStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  UNDER_REVIEW
}

enum ReportType {
  GENERAL
  SECURITY_ANALYSIS
  PROGRAM_REVIEW
  SUBMISSION_REPORT
  AUDIT_REPORT
  COMPLIANCE_REPORT
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model HealthCheck {
  id        String   @id @default(cuid())
  status    String // "healthy" | "unhealthy"
  timestamp DateTime @default(now())
  service   String   @default("api")
  metadata  Json? // Store additional health info

  @@map("health_checks")
}
`;

try {
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
  fs.writeFileSync(schemaPath, fixedSchema);
  console.log('✅ Schema updated with consistent string IDs\n');
} catch (error) {
  console.error('❌ Failed to update schema:', error.message);
  process.exit(1);
}

// Step 3: Generate Prisma client
console.log('3️⃣ Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated\n');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  process.exit(1);
}

// Step 4: Instructions for deployment
console.log('4️⃣ Next steps for deployment:\n');
console.log('🚀 DEPLOYMENT INSTRUCTIONS:');
console.log('1. Deploy this updated schema to your production database');
console.log('2. Run: npx prisma db push --force-reset (⚠️  This will reset your data!)');
console.log('3. Or create a new migration: npx prisma migrate dev --name fix-id-types');
console.log('4. Ensure your environment variables are set correctly:');
console.log('   - DATABASE_URL (PostgreSQL connection string)');
console.log('   - JWT_SECRET');
console.log('   - All other required environment variables');
console.log('5. Redeploy your backend application\n');

console.log('✅ Database schema fix completed!');
console.log('\n📝 Summary of changes:');
console.log('- Changed all ID fields from Int to String with @default(cuid())');
console.log('- Fixed foreign key relationships to use string IDs');
console.log('- Made schema consistent with existing migrations');
console.log('\n⚠️  WARNING: This change requires database reset or careful migration!');
