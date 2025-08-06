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
    // Validate input
    if (!user || !user.id || !user.role) {
      throw new Error("User object with id and role is required");
    }

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
    console.error("Access token generation error:", error);
    throw new Error(`Failed to generate access token: ${error}`);
  }
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = config.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not defined");
  }

  if (!token) {
    throw new Error("Token is required");
  }

  try {
    const decoded = jwt.verify(token, secret as Secret) as AccessTokenPayload;
    
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Access token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid access token");
    }
    throw new Error(`Invalid access token: ${error}`);
  }
};

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

export const generateRefreshToken = async (userId: string): Promise<{ token: string; expiresAt: Date }> => {
  try {
    // Validate input - THIS FIXES THE MAIN ERROR
    if (!userId) {
      throw new Error("User ID is required for refresh token generation");
    }

    const secret = config.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET not defined")
    }

    // Verify user exists and is active
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!userExists) {
      throw new Error("User not found");
    }

    if (!userExists.isActive) {
      throw new Error("User account is not active");
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
      },
    })

    console.log(`Refresh token generated successfully for user: ${userId}`);
    return { token, expiresAt }
  } catch (error) {
    console.error("Refresh token generation error:", error);
    throw new Error(`Failed to generate refresh token: ${error}`)
  }
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

export const verifyRefreshToken = async (token: string, userId: string, sessionId?: string): Promise<boolean> => {
  try {
    // Validate inputs
    if (!token) {
      console.log("Refresh token verification failed: No token provided");
      return false;
    }

    if (!userId) {
      console.log("Refresh token verification failed: No user ID provided");
      return false;
    }

    const secret = config.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET not defined")
    }

    // Verify JWT token
    const decoded = jwt.verify(token, secret as Secret) as { id: string; type: string }
    
    if (decoded.id !== userId || decoded.type !== "refresh") {
      console.log("Refresh token verification failed: Invalid token payload");
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
      console.log("Refresh token verification failed: User not found or inactive");
      return false
    }

    // Check if token is expired
    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      console.log("Refresh token verification failed: Token expired");
      return false
    }

    // Compare provided token with stored hash
    const isValid = await bcrypt.compare(token, user.refreshTokenHash)
    
    if (isValid) {
      console.log(`Refresh token verified successfully for user: ${userId}`);
    } else {
      console.log("Refresh token verification failed: Token hash mismatch");
    }

    return isValid
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log("Refresh token verification failed: Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log("Refresh token verification failed: Invalid token");
    } else {
      console.error("Refresh token verification error:", error);
    }
    return false
  }
}

// ============================================================================
// TOKEN INVALIDATION
// ============================================================================

export const invalidateRefreshToken = async (userId: string, sessionId?: string): Promise<void> => {
  try {
    if (!userId) {
      throw new Error("User ID is required for token invalidation");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { 
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    })

    console.log(`Refresh token invalidated successfully for user: ${userId}`);
  } catch (error) {
    console.error("Token invalidation error:", error);
    throw new Error(`Failed to invalidate refresh token: ${error}`)
  }
}

// ============================================================================
// TOKEN CLEANUP (Optional utility)
// ============================================================================

export const cleanupExpiredTokens = async (): Promise<{ count: number }> => {
  try {
    const result = await prisma.user.updateMany({
      where: {
        refreshTokenExpiresAt: {
          lt: new Date(),
        },
      },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    })

    console.log(`Cleaned up ${result.count} expired tokens`);
    return { count: result.count };
  } catch (error) {
    console.error("Token cleanup error:", error);
    throw new Error(`Failed to cleanup expired tokens: ${error}`)
  }
}

// ============================================================================
// ADDITIONAL UTILITY FUNCTIONS
// ============================================================================

export const refreshTokens = async (refreshToken: string, userId: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date } | null> => {
  try {
    // Verify the refresh token
    const isValidRefreshToken = await verifyRefreshToken(refreshToken, userId);
    
    if (!isValidRefreshToken) {
      console.log("Token refresh failed: Invalid refresh token");
      return null;
    }

    // Get user data for new access token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        role: true,
        email: true,
        isActive: true
      },
    });

    if (!user || !user.isActive) {
      console.log("Token refresh failed: User not found or inactive");
      return null;
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    const { token: newRefreshToken, expiresAt } = await generateRefreshToken(user.id);

    console.log(`Tokens refreshed successfully for user: ${userId}`);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};
