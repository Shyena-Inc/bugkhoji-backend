import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ReportStatus, ReportType, Priority } from '@prisma/client';

// Optionally define a type for body
interface ReportBody {
  title?: string;
  content?: string;
}

export interface CreateReportDTO {
  title: string;
  description: string;
  content?: string;
  status?: ReportStatus;
  type?: ReportType;
  priority?: Priority;
  programId?: string;
  submissionId?: string;
  tags?: string[];
  isPublic?: boolean;
  attachments?: string[]; 
}

export const ValidateReportData: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, content } = req.body as ReportBody;

  if (!title || !content) {
    res.status(400).json({
      error: 'Title and content are required fields',
    });
    return;
  }

  if (title.trim().length < 3) {
    res.status(400).json({
      error: 'Title must be at least 3 characters long',
    });
    return;
  }

  if (content.trim().length < 10) {
    res.status(400).json({
      error: 'Content must be at least 10 characters long',
    });
    return;
  }

  next();
};


