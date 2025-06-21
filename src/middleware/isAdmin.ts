import { UserRole } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

interface CustomRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: UserRole; 
    isActive: boolean;
    sessionId?: string;
    [key: string]: any;
  };
} 

const isAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === UserRole.ADMIN) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admins only' });
};

export default isAdmin;
