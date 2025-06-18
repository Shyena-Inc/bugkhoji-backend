import { z } from 'zod';
import { ReportStatus, ReportType, Priority } from '@prisma/client';

// CUID validation function
const cuidRegex = /^c[a-z0-9]{24}$/;
const cuidValidation = z.string().regex(cuidRegex, "Invalid ID format");

// Base schema for common report fields
const reportBaseSchema = z.object({
  title: z.string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description must be less than 1000 characters")
    .trim(),
  content: z.string().optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  type: z.nativeEnum(ReportType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  tags: z.array(z.string().trim().min(1, "Tag cannot be empty")).optional(),
  isPublic: z.boolean().optional(),
  attachments: z.array(z.string().url("Invalid attachment URL")).optional(),
  metadata: z.record(z.unknown()).optional() // Add metadata support
});

// Create Report Validation
export const createReportSchema = reportBaseSchema.extend({
  programId: cuidValidation.optional(),
  submissionId: cuidValidation.optional()
});

// Update Report Validation - Remove ID from body, it comes from params
export const updateReportSchema = reportBaseSchema.partial().extend({
  programId: z.string().uuid("Invalid program ID format").optional(),
  submissionId: z.string().uuid("Invalid submission ID format").optional()
});

// Query Params Validation - Enhanced with coercion
export const reportQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").optional().default(1),
  limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").optional().default(10),
  status: z.nativeEnum(ReportStatus).optional(),
  type: z.nativeEnum(ReportType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().min(1, "Search term cannot be empty").optional(),
  tags: z.string().optional(), // Comma-separated string
  isPublic: z.coerce.boolean().optional(),
  programId: z.string().uuid("Invalid program ID format").optional(),
  submissionId: z.string().uuid("Invalid submission ID format").optional()
}).transform(data => ({
  ...data,
  // Transform comma-separated tags to array for easier processing
  tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : undefined
}));

// Parameter validation schemas
export const reportIdParamSchema = z.object({
  id: z.string().uuid("Invalid report ID format")
});

export const programIdParamSchema = z.object({
  programId: cuidValidation
});

export const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid("Invalid submission ID format")
});

// Combined schemas for routes that need both body and params
export const updateReportWithParamsSchema = {
  body: updateReportSchema,
  params: reportIdParamSchema
};

export const getReportByIdSchema = {
  params: reportIdParamSchema
};

// Utility type exports for TypeScript
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ReportQueryInput = z.input<typeof reportQuerySchema>;
export type ReportQueryOutput = z.output<typeof reportQuerySchema>;