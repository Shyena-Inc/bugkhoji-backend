import jwt, { type Secret, type SignOptions } from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { config } from "./config"

const prisma = new PrismaClient()

// ============================================================================
// ACCESS TOKEN GENERATION
// ============================================================================

// Update the interface to include sessionId
interface AccessTokenPayload {
  id: string;
  role: string;
  type: string;
  sessionId?: string;  // Add sessionId
  iat: number;
  exp: number;
}

// Updated function signature to accept an object
export const generateAccessToken = (user: { 
  id: string; 
  role: string; 
  email?: string;
  sessionId?: string;  // Add sessionId
}): string => {
  try {
    const secret = config.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET not defined");
    }

    // Create payload for access token
    const payload = {
      id: user.id,
      role: user.role,
      type: "access",
      sessionId: user.sessionId,  // Include sessionId in payload
      iat: Math.floor(Date.now() / 1000),
    };

    // Set expiration time (1 hour)
    const expiresIn = "1h";

    // Generate JWT token with proper typing
    const token = jwt.sign(payload, secret as Secret, {
      expiresIn,
    } as SignOptions);

    return token;
  } catch (error) {
    throw new Error(`Failed to generate access token: ${error}`);
  }
};
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = config.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not defined");
  }

  try {
    const decoded = jwt.verify(token, secret as Secret) as AccessTokenPayload;
    
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    throw new Error(`Invalid access token: ${error}`);
  }
};

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

export const generateRefreshToken = async (userId: string, id: string): Promise<{ token: string; expiresAt: Date }> => {
  try {
    const secret = config.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET not defined")
    }

    // Create payload for refresh token
    const payload = {
      id: userId,
      type: "refresh",
      iat: Math.floor(Date.now() / 1000),
    }

    // Set expiration time (7 days)
    const expiresIn = "7d"
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    // Generate JWT token with proper typing
    const token = jwt.sign(payload, secret as Secret, {
      expiresIn,
    } as SignOptions)

    // Hash the token for database storage
    const tokenHash = await bcrypt.hash(token, 10)

    // Store refresh token hash in database
    // Note: Make sure your User model has a refreshTokenHash field
    await prisma.user.update({
      where: { id: userId },
      data: { 
        refreshTokenHash: tokenHash,
        refreshTokenExpiresAt: expiresAt,
      } as any, // Type assertion to bypass Prisma type issues
    })

    return { token, expiresAt }
  } catch (error) {
    throw new Error(`Failed to generate refresh token: ${error}`)
  }
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

export const verifyRefreshToken = async (token: string, userId: string, sessionId: string): Promise<boolean> => {
  try {
    const secret = config.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET not defined")
    }

    // Verify JWT token
    const decoded = jwt.verify(token, secret as Secret) as { id: string; type: string }
    
    if (decoded.id !== userId || decoded.type !== "refresh") {
      return false
    }

    // Get stored token hash from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        refreshTokenHash: true, 
        refreshTokenExpiresAt: true,
        isActive: true 
      },
    })

    if (!user || !user.refreshTokenHash || !user.isActive) {
      return false
    }

    // Check if token is expired
    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      return false
    }

    // Compare provided token with stored hash
    const isValid = await bcrypt.compare(token, user.refreshTokenHash)
    return isValid
  } catch (error) {
    return false
  }
}

// ============================================================================
// TOKEN INVALIDATION
// ============================================================================

export const invalidateRefreshToken = async (userId: string, sessionId: string): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      } as any, // Type assertion to bypass Prisma type issues
    })
  } catch (error) {
    throw new Error(`Failed to invalidate refresh token: ${error}`)
  }
}

// ============================================================================
// TOKEN CLEANUP (Optional utility)
// ============================================================================

export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    await prisma.user.updateMany({
      where: {
        refreshTokenExpiresAt: {
          lt: new Date(),
        },
      },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      } as any, // Type assertion to bypass Prisma type issues
    })
  } catch (error) {
    throw new Error(`Failed to cleanup expired tokens: ${error}`)
  }
}