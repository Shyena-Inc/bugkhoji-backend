// controllers/auth.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { parseUserAgent, getGeoLocation } from '../utils/device';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../schemas/auth.schemas';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  invalidateRefreshToken,
} from '../utils/token';
import { createAuditLog } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Enhanced login function with session tracking
export async function login(req: Request, res: Response) {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    // Check if user exists and is active
    if (!user || !user.isActive) {
      logger.warn(
        `Login attempt for non-existent or inactive user: ${validatedData.email}`
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check passwordHash is not null
    if (!user.passwordHash) {
      logger.warn(`User ${user.email} does not have a password hash set`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(
      validatedData.password,
      user.passwordHash
    );

    if (!passwordMatch) {
      logger.warn(`Failed login attempt for user: ${user.email}`);

      await createAuditLog(
        {
          userId: user.id,
          action: "LOGIN_FAILED",
          entity: "USER",
          entityId: user.id,
          details: "Failed login attempt",
        },
        req
      );

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create session
    const sessionId = uuidv4();
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    const location = await getGeoLocation(ip);
    const deviceInfo = parseUserAgent(userAgent);

    // Save session to database
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        userAgent,
        deviceOS: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        deviceType: deviceInfo.device || 'Unknown',
        ipAddress: ip,
        location: typeof location === 'object' && location !== null && 'city' in location ? (location as any).city : (typeof location === 'string' ? location : 'Unknown'),
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate tokens with session ID
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    const { token: refreshToken } = await generateRefreshToken(user.id, session.id);

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    // Create audit log for successful login
    await createAuditLog(
      {
        userId: user.id,
        action: "LOGIN_SUCCESS",
        entity: "USER",
        entityId: user.id,
        details: `Successful login from ${deviceInfo.device} (${ip})`,
      },
      req
    );

    // Return user data, tokens, and session info
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      session: {
        id: session.id,
        device: deviceInfo,
        location: session.location,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res.status(400).json({ error: errorMessage });
  }
}

// Update refreshToken function to validate sessions
export async function refreshToken(req: Request, res: Response) {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not found" });
    }

    // Decode token to get user ID and session ID
    const decoded = jwt.decode(refreshToken) as {
      id: string;
      sessionId: string;
    } | null;

    if (!decoded || !decoded.id || !decoded.sessionId) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Verify session is still active
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Verify refresh token
    const isValid = await verifyRefreshToken(refreshToken, decoded.id, decoded.sessionId);

    if (!isValid) {
      logger.warn(`Invalid refresh token used for session: ${decoded.sessionId}`);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      logger.warn(
        `Refresh token used for non-existent or inactive user: ${decoded.id}`
      );
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Update session last seen
    await prisma.session.update({
      where: { id: decoded.sessionId },
      data: { lastSeen: new Date() },
    });

    // Generate new tokens with same session ID
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: decoded.sessionId,
    });

    const { token: newRefreshToken } = await generateRefreshToken(user.id, decoded.sessionId);

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Create audit log
    await createAuditLog(
      {
        userId: user.id,
        action: "TOKEN_REFRESH",
        entity: "USER",
        entityId: user.id,
        details: `Token refreshed for session ${decoded.sessionId}`,
      },
      req
    );

    return res.status(200).json({ accessToken });
  } catch (error) {
    logger.error("Token refresh error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res.status(400).json({ error: errorMessage });
  }
}

// Enhanced logout function to terminate sessions
export async function logout(req: Request, res: Response) {
  try {
    // Get user ID and session ID from authenticated request
    const userId = req.user?.id;
    const sessionId = req.user?.sessionId;

    if (userId && sessionId) {
      // Invalidate session
      await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false, expiresAt: new Date() },
      });

      // Invalidate refresh token
      await invalidateRefreshToken(userId, sessionId);

      // Create audit log
      await createAuditLog(
        {
          userId,
          action: "LOGOUT",
          entity: "USER",
          entityId: userId,
          details: `User logged out from session ${sessionId}`,
        },
        req
      );
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}