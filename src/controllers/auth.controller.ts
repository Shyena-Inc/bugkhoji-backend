// controllers/auth.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { parseUserAgent, getGeoLocation } from '../utils/device';
import {loginSchema } from '../schemas/auth.schemas';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  invalidateRefreshToken,
} from '../utils/token';
import { createAuditLog } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user || !user.isActive) {
      logger.warn(
        `Login attempt for non-existent or inactive user: ${validatedData.email}`
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      logger.warn(`User ${user.email} does not have a password hash set`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

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

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const sessionId = uuidv4();
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    const location = await getGeoLocation(ip);
    const deviceInfo = parseUserAgent(userAgent);

    const session = await prisma.session.create({
      data: {
        id: +sessionId,
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

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    const { token: refreshToken } = await generateRefreshToken(user.id, session.id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

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

export async function refreshToken(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not found" });
    }

    const decoded = jwt.decode(refreshToken) as {
      id: string;
      sessionId: string;
    } | null;

    if (!decoded || !decoded.id || !decoded.sessionId) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const session = await prisma.session.findUnique({
      where: { id: +decoded.sessionId },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    const isValid = await verifyRefreshToken(refreshToken, decoded.id, decoded.sessionId);

    if (!isValid) {
      logger.warn(`Invalid refresh token used for session: ${decoded.sessionId}`);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: +decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      logger.warn(
        `Refresh token used for non-existent or inactive user: ${decoded.id}`
      );
      return res.status(401).json({ error: "User not found or inactive" });
    }

    await prisma.session.update({
      where: { id: +decoded.sessionId },
      data: { lastSeen: new Date() },
    });

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: +decoded.sessionId,
    });

    const { token: newRefreshToken } = await generateRefreshToken(user.id, +decoded.sessionId);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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

export async function logout(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const sessionId = req.user?.sessionId;

    if (userId && sessionId) {
      await prisma.session.update({
        where: { id: +sessionId },
        data: { isActive: false, expiresAt: new Date() },
      });

      await invalidateRefreshToken(userId, +sessionId);

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

    res.clearCookie("refreshToken");

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}