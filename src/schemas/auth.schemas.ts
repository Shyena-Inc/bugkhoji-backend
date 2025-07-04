// schemas/auth.schemas.ts
import { z } from 'zod';

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters"),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// RESEARCHER REGISTRATION SCHEMA
// ============================================================================

export const registerSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters"),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(30, "Username must be less than 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s'-]+$/,
      "First name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s'-]+$/,
      "Last name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must accept the terms and conditions to register",
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================================================
// ORGANIZATION REGISTRATION SCHEMA
// ============================================================================

export const organizationRegisterSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters"),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters long")
    .max(100, "Organization name must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s&.,'-]+$/,
      "Organization name contains invalid characters"
    ),
  
  website: z
    .string()
    .url("Please enter a valid website URL")
    .max(255, "Website URL must be less than 255 characters")
    .optional()
    .or(z.literal('')),
  
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must accept the terms and conditions to register",
    }),
});

export type OrganizationRegisterInput = z.infer<typeof organizationRegisterSchema>;

// ============================================================================
// PASSWORD RESET SCHEMAS
// ============================================================================

export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters"),
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z.object({
  token: z
    .string()
    .min(1, "Reset token is required"),
  
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  
  confirmPassword: z
    .string()
    .min(1, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// ============================================================================
// CHANGE PASSWORD SCHEMA
// ============================================================================

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required"),
  
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  
  confirmPassword: z
    .string()
    .min(1, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================================
// EMAIL VERIFICATION SCHEMA
// ============================================================================

export const emailVerificationSchema = z.object({
  token: z
    .string()
    .min(1, "Verification token is required"),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;

// ============================================================================
// TERMS UPDATE SCHEMA
// ============================================================================

export const termsUpdateSchema = z.object({
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must accept the updated terms and conditions",
    }),
});

export type TermsUpdateInput = z.infer<typeof termsUpdateSchema>;