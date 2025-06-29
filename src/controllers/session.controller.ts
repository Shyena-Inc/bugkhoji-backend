import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
// import { parseUserAgent, getGeoLocation } from '../utils/device';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function createSession(req: Request, userId: string) {
  try {
    const sessionId = crypto.randomUUID();
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    // const location = await getGeoLocation(ip);
    // const deviceInfo = parseUserAgent(userAgent);

    const session = await prisma.session.create({
      data: {
        id: +sessionId,
        userId:+userId,
        userAgent,
        ipAddress: ip,
        deviceOS: '',
        deviceType: '',
        deviceBrowser: '', 
        location: '', 
        lastSeen: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) 
      }
    });
    
    return {
      success: true,
      message:'Session created sucessfully',
      session:{
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }
    };
  } catch (error) {
    logger.error('Error creating session:', error);
    throw error;
  }
}

export async function getSessions(req: Request, res: Response) {
  try {
    // Check if user exists in request
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        isActive: true
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceOS: true,
        deviceType: true,
        deviceBrowser: true,
        location: true,
        lastSeen: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: {
        lastSeen: 'desc'
      }
    });

    // Add more detailed response
    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions,
      message: sessions.length ? 'Sessions retrieved successfully' : 'No active sessions found'
    });
    
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch sessions' 
    });
  }
}

export async function updateSessionActivity(sessionId: string) {
  try {
    await prisma.session.update({
      where: { id: +sessionId },
      data: { lastSeen: new Date() }
    });
  } catch (error) {
    logger.error('Error updating session activity:', error);
    throw error;
  }
}

export async function terminateSession(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.body;

    // Verify the session belongs to the user
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Deactivate session
    await prisma.session.delete({
      where: { id: sessionId }
    });

    res.json({ message: 'Session terminated successfully' });
  } catch (error) {
    logger.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
}