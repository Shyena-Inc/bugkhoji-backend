import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma'
import authenticate from '../middleware/authenticate'; 
import isAdmin from '../middleware/isAdmin'; 
import express from 'express';

const router = express.Router();

router.patch('/authorize-user/:id', authenticate as RequestHandler, isAdmin as RequestHandler, async (req: Request, res: Response) => {
  const userId = req.params.id;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: +userId },
      data: { isActive: true }, 
    });

    res.status(200).json({ message: 'User authorized successfully', user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ message: 'Error authorizing user', error: error.message });
  }
});

export default router;
