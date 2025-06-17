import { z } from 'zod';
import { ReportStatus, ReportType, Priority } from '@prisma/client';

// Base schema for common report fields
const reportBaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  content: z.string().optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  type: z.nativeEnum(ReportType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  attachments: z.array(z.string()).optional()
});

// Create Report Validation
export const createReportSchema = reportBaseSchema.extend({
  programId: z.string().optional(),
  submissionId: z.string().optional()
});

// Update Report Validation
export const updateReportSchema = reportBaseSchema.partial().extend({
  id: z.string() // Ensure ID is required for updates
});

// Query Params Validation
export const reportQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  type: z.nativeEnum(ReportType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated string
  isPublic: z.string().regex(/^(true|false)$/).optional(),
  programId: z.string().optional(),
  submissionId: z.string().optional()
});