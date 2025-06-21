import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  version?: string;
}

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - startTime;
    
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        responseTime: dbResponseTime
      },
      version: process.env.npm_package_version || '1.0.0'
    };
    
    res.status(200).json(healthStatus);
  } catch (error) {
    const healthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'disconnected'
      }
    };
    
    res.status(503).json(healthStatus);
  }
};

export const detailedHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const checks = {
    database: false,
    memory: false,
    disk: false
  };
  
  let overallStatus: 'healthy' | 'unhealthy' = 'healthy';
  
  try {
    // Database check
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    const dbTime = Date.now() - dbStart;
    
    // Memory check (fail if using more than 90% of available memory)
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = memPercent < 90;
    
    // Simple disk space check (you might want to use a library for this)
    checks.disk = true; // Placeholder - implement actual disk check if needed
    
    // Overall status
    overallStatus = Object.values(checks).every(check => check) ? 'healthy' : 'unhealthy';
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: checks.database ? 'pass' : 'fail',
          responseTime: checks.database ? dbTime : undefined
        },
        memory: {
          status: checks.memory ? 'pass' : 'fail',
          usage: `${Math.round(memPercent)}%`,
          details: memUsage
        },
        disk: {
          status: checks.disk ? 'pass' : 'fail'
        }
      },
      version: process.env.npm_package_version || '1.0.0'
    };
    
    res.status(overallStatus === 'healthy' ? 200 : 503).json(response);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks
    });
  }
};