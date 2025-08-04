// controllers/auth.controller.ts - FIXED VERSION
import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { parseUserAgent, getGeoLocation } from '../utils/device';
import { config } from '../utils/config';
import {
  type LoginInput,
  type RegisterInput,
  type OrganizationRegisterInput
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie('accessToken', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: false,
    maxAge: 15 * 60 * 1000, // 15 minutes (access tokens should have shorter expiry)
    path: '/',
  });
}

const handleLoginSuccess = async (
  user: any,
  req: Request,
  res: Response,
  userType: string
): Promise<void> => {
  try {
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create session
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    const location = await getGeoLocation(ip);
    const deviceInfo = parseUserAgent(userAgent);

    const session = await prisma.session.create({
      data: {
        // Remove the manual ID assignment - let Prisma auto-generate
        userId: user.id, // Now a string
        userAgent,
        deviceOS: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        deviceType: deviceInfo.device || 'Unknown',
        ipAddress: ip,
        location: typeof location === 'object' && location !== null && 'city' in location 
          ? (location as any).city 
          : (typeof location === 'string' ? location : 'Unknown'),
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    const { token: refreshToken } = await generateRefreshToken(user.id, session.id);

    // Set refresh token cookie
    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken);


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

    logger.info(`Successful ${userType.toLowerCase()} login for user: ${user.id}`);

    res.status(200).json({
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        termsAccepted: user.termsAccepted,
        termsAcceptedAt: user.termsAcceptedAt,
      },
      session: {
        id: session.id,
        device: deviceInfo,
        location: session.location,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error in handleLoginSuccess:', error);
    throw error;
  }
};

// ============================================================================
// REGISTRATION CONTROLLERS
// ============================================================================

export async function registerResearcher(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username, firstName, lastName, termsAccepted } = req.body as RegisterInput & { termsAccepted: boolean };

    logger.info(`Registration attempt for email: ${email}`);

    // Validate terms acceptance
    if (!termsAccepted) {
      res.status(400).json({ error: "Terms and conditions must be accepted" });
      return;
    }

    // Check if email or username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      const conflictField = existingUser.email === email ? "Email" : "Username";
      logger.warn(`Registration failed: ${conflictField} already exists for ${email}`);
      res.status(409).json({ error: `${conflictField} already exists` });
      return;
    }

    // Hash password with high salt rounds
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new researcher user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        firstName,
        lastName,
        role: UserRole.RESEARCHER,
        termsAccepted,
        termsAcceptedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog(
      {
        userId: user.id,
        action: "REGISTER",
        entity: "USER",
        entityId: user.id,
        details: `Researcher registration successful`,
      },
      req
    );

    logger.info(`Researcher registration successful for user: ${user.id}`);
    res.status(201).json({ 
      message: "Registration successful",
      userId: user.id 
    });
  } catch (error) {
    logger.error("Server error during researcher registration:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
}

export async function registerOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, organizationName, website, description, termsAccepted } = req.body as OrganizationRegisterInput & { termsAccepted: boolean };

    logger.info(`Organization registration attempt for: ${organizationName}`);

    // Validate terms acceptance
    if (!termsAccepted) {
      res.status(400).json({ error: "Terms and conditions must be accepted" });
      return;
    }

    // Check if organization email already exists
    const existingOrg = await prisma.user.findUnique({
      where: { email },
    });

    if (existingOrg) {
      logger.warn(`Registration failed: Email already exists for ${email}`);
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    // Generate username and check for conflicts
    let baseUsername = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_") // Replace non-alphanumeric with underscore
      .replace(/_+/g, "_") // Replace multiple underscores with single
      .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
      .substring(0, 30); // Limit length

    let username = baseUsername;
    let counter = 1;

    // Ensure username uniqueness
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}_${counter}`;
      counter++;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new organization user with transaction
    const user = await prisma.$transaction(async (tx) => {
      return await tx.user.create({
        data: {
          email,
          passwordHash,
          username,
          firstName: organizationName,
          lastName: "",
          role: UserRole.ORGANIZATION,
          isActive: false, // Organizations need admin approval
          termsAccepted,
          termsAcceptedAt: new Date(),
          organization: {
            create: {
              name: organizationName,
              website: website || null,
              description: description || null,
            },
          },
        },
        include: {
          organization: true,
        },
      });
    });

    // Create audit log
    await createAuditLog(
      {
        userId: user.id,
        action: "REGISTER",
        entity: "USER",
        entityId: user.id,
        details: `Organization registration successful: ${organizationName}`,
      },
      req
    );

    logger.info(`Organization registration successful for user ID: ${user.id}`);

    res.status(201).json({
      message: "Registration successful. Please wait for admin approval to activate your account.",
      userId: user.id,
    });
  } catch (error) {
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        logger.warn(`Registration failed: Duplicate data for ${req.body.organizationName}`);
        res.status(409).json({
          error: "Registration data conflicts with existing account",
        });
        return;
      }
    }

    logger.error("Server error during organization registration:", {
      error: error instanceof Error ? error.message : "Unknown error",
      organizationName: req.body.organizationName,
      email: req.body.email,
    });
    res.status(500).json({ error: "Server error during registration" });
  }
}

// ============================================================================
// LOGIN CONTROLLER
// ============================================================================

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, userType } = req.body as LoginInput & { userType: string };

    logger.info(`Login attempt for ${userType.toLowerCase()} email: ${email}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        username: true,
        firstName: true,
        lastName: true,
        termsAccepted: true,
        termsAcceptedAt: true,
      },
    });

    // Check if user exists
    if (!user) {
      logger.warn(`Failed login attempt for ${userType.toLowerCase()} email: ${email} - User not found`);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Check role-specific conditions
    if (user.role !== userType) {
      logger.warn(`Failed login attempt for email: ${email} - Invalid role. Expected: ${userType}, Got: ${user.role}`);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Check if user is active (except for organizations which have special handling)
    if (user.role === UserRole.ORGANIZATION && !user.isActive) {
      logger.warn(`Failed login attempt for organization: ${email} - Account not activated`);
      res.status(401).json({
        error: "Account pending activation. Please wait for admin approval."
      });
      return;
    }

    if (user.role !== UserRole.ORGANIZATION && !user.isActive) {
      logger.warn(`Failed login attempt for ${userType.toLowerCase()}: ${email} - Account inactive`);
      res.status(401).json({ error: "Account is inactive" });
      return;
    }

    // Verify password
    if (!user.passwordHash) {
      logger.warn(`Failed login attempt for ${userType.toLowerCase()}: ${user.email} - No password hash found`);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      logger.warn(`Failed login attempt for ${userType.toLowerCase()}: ${user.email} - Invalid password`);
      
      // Create audit log for failed login
      await createAuditLog(
        {
          userId: user.id,
          action: "LOGIN_FAILED",
          entity: "USER",
          entityId: user.id,
          details: `Failed login attempt from ${req.ip}`,
        },
        req
      );

      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Handle successful login
    await handleLoginSuccess(user, req, res, userType);
  } catch (error) {
    logger.error(`${req.body.userType || 'User'} login error:`, error);
    res.status(500).json({ error: "Server error during login" });
  }
}

// ============================================================================
// TOKEN MANAGEMENT CONTROLLERS
// ============================================================================

export async function refreshToken(req: Request, res: Response): Promise<void> {
  
  try {
    // Check if cookies exist and extract refresh token
    const refreshToken = req.cookies?.refreshToken;
    console.log('Refresh token:', refreshToken);

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token not found" });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_SECRET!) as { 
        id: string; // CHANGED: from number to string
        sessionId?: string; // CHANGED: from number to string
        type?: string;
      };
      console.log("Decoded token:", decoded);
    } catch (err) {
      console.error("JWT Verification Error:", err);
      res.status(401).json({ error: "Invalid refresh token (JWT verification failed)" });
      return;
    }

    if (!decoded || !decoded.id) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    // Handle old tokens without sessionId
    let sessionId = decoded.sessionId;
    
    if (!sessionId) {
      console.log("No sessionId found in token, looking for existing session or creating new one");
      
      // Look for an active session for this user
      const existingSession = await prisma.session.findFirst({
        where: { 
          userId: decoded.id, // Now string
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { lastSeen: 'desc' } // Get the most recent session
      });
      
      if (existingSession) {
        sessionId = existingSession.id;
        console.log("Found existing session:", sessionId);
      } else {
        // Create new session with device info
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.ip || req.connection?.remoteAddress || '';
        const location = await getGeoLocation(ip);
        const deviceInfo = parseUserAgent(userAgent);

        const newSession = await prisma.session.create({
          data: {
            userId: decoded.id, // Now string
            userAgent,
            deviceOS: deviceInfo.os,
            deviceBrowser: deviceInfo.browser,
            deviceType: deviceInfo.device || 'Unknown',
            ipAddress: ip,
            location: typeof location === 'object' && location !== null && 'city' in location 
              ? (location as any).city 
              : (typeof location === 'string' ? location : 'Unknown'),
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
        sessionId = newSession.id;
        console.log("Created new session:", sessionId);
      }
    }

    console.log("Using sessionId:", sessionId);

    // Check session validity
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      res.status(401).json({ error: "Session expired or invalid" });
      return;
    }

    // For old tokens, we'll skip the database verification since they won't be in the refresh_tokens table
    if (decoded.sessionId) {
      // Verify refresh token only for new tokens that have sessionId
      const isValid = await verifyRefreshToken(refreshToken, decoded.id, sessionId); // Both now strings
      
      if (!isValid) {
        logger.warn(`Invalid refresh token used for session: ${sessionId}`);
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }
    } else {
      console.log("Skipping database verification for old token format");
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }, // Now string
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      logger.warn(`Refresh token used for non-existent or inactive user: ${decoded.id}`);
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    // Update session last seen
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastSeen: new Date() },
    });

    // Generate new tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionId,
    });

    const { token: newRefreshToken } = await generateRefreshToken(user.id, sessionId); // Both now strings

    // Set both tokens as cookies
    setRefreshTokenCookie(res, newRefreshToken);
    setAccessTokenCookie(res, accessToken); 

    // Create audit log
    await createAuditLog(
      {
        userId: user.id,
        action: "TOKEN_REFRESH",
        entity: "USER",
        entityId: user.id,
        details: `Token refreshed for session ${sessionId}`,
      },
      req
    );

    res.status(200).json({ token: accessToken });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const sessionId = req.user?.sessionId;

    if (userId && sessionId) {
      // Deactivate session
      await prisma.session.update({
        where: { id: sessionId }, // Now string
        data: { isActive: false, expiresAt: new Date() },
      });

      // Invalidate refresh token
      await invalidateRefreshToken(userId, sessionId); // Both now strings

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

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
