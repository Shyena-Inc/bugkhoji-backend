import { Request, Response, NextFunction } from "express";

export const validateReportData = (
  req: Request<{},{},{ title?: string; content?: string }>,
  res: Response,
  next: NextFunction
): void => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    res.status(400).json({ 
      error: 'Title and content are required fields' 
    });
    return;
  }

  if (title.trim().length < 3) {
    res.status(400).json({ 
      error: 'Title must be at least 3 characters long' 
    });
    return;
  }

  if (content.trim().length < 10) {
    res.status(400).json({ 
      error: 'Content must be at least 10 characters long' 
    });
    return;
  }

  next();
};