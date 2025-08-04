import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  sessionId: string;
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check for access token in cookies first
    let token = req.cookies?.accessToken;
    
    // Fallback to Authorization header if no cookie
    if (!token) {
      const authHeader = req.headers.authorization;
      token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;
    }

    if (!token) {
      res.status(401).json({ error: "No authentication token found in cookies" });
      return;
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Optional: Verify session is still active
    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        select: { isActive: true, expiresAt: true }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        res.status(401).json({ error: "Session expired or invalid" });
        return;
      }
    }

    // Get user data to match the expected type
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    // Add user info to request with correct type
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      sessionId: decoded.sessionId,
    };
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}