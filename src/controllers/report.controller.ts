import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import reportsDb from '../utils/prisma-reports';
import { AuthenticatedRequest } from '../middleware/reports';
import { 
  CreateReportDTO, 
  UpdateReportDTO, 
  ReportQueryParams,
  ReportWithAuthor,
  ReportWithRelations,
  PaginationResponse
} from '../types/report.types';
import { ReportStatus, ReportType, Priority } from '@prisma/client../generated/reports-client';

class ReportController {
  // GET /reports
  async getAllReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        status,
        type,
        priority,
        search,
        tags,
        isPublic,
        programId,
        submissionId
      }: ReportQueryParams = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Build where clause
      const where: any = {
        OR: [
          { authorId: req.user.id },
          { isPublic: true },
          {
            collaborators: {
              some: { userId: req.user.id }
            }
          }
        ]
      };

      if (status) where.status = status;
      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (programId) where.programId = programId;
      if (submissionId) where.submissionId = submissionId;
      if (isPublic !== undefined) where.isPublic = isPublic === 'true';

      if (search) {
        where.AND = {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        };
      }

      if (tags) {
        const tagArray = tags.split(',').map((tag: string) => tag.trim());
        where.tags = {
          hasSome: tagArray
        };
      }

      const [reports, total] = await Promise.all([
        reportsDb.report.findMany({
          where,
          include: {
            collaborators: true,
            comments: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            },
            childReports: {
              select: { id: true, title: true, status: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        reportsDb.report.count({ where })
      ]);

      // Enrich with user data from main database
      const enrichedReports: ReportWithAuthor[] = await Promise.all(
        reports.map(async (report: { authorId: any; }) => {
          const author = await prisma.user.findUnique({
            where: { id: report.authorId },
            select: { id: true, name: true, email: true, role: true }
          });

          return {
            ...report,
            author: author ?? undefined
          };
        })
      );

      const response: PaginationResponse<ReportWithAuthor> = {
        data: enrichedReports,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / take),
          totalItems: total,
          itemsPerPage: take,
          hasNext: skip + take < total,
          hasPrev: parseInt(page) > 1
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }

  // POST /reports
  async createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        title,
        description,
        content,
        status = ReportStatus.DRAFT,
        type = ReportType.GENERAL,
        priority = Priority.MEDIUM,
        programId,
        submissionId,
        tags = [],
        isPublic = false,
        metadata
      }: CreateReportDTO = req.body;

      const user = req.user;

      const report = await reportsDb.report.create({
        data: {
          title,
          description,
          content,
          status,
          type,
          priority,
          authorId: user.id,
          authorEmail: user.email,
          authorName: user.name,
          programId,
          submissionId,
          tags,
          isPublic,
          metadata: metadata ?? {}
        },
        include: {
          collaborators: true,
          comments: true,
          versions: true
        }
      });

      const response: ReportWithAuthor = {
        ...report,
        author: user
      };

      res.status(201).json({
        message: 'Report created successfully',
        data: response
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  }

  // GET /reports/:id
  async getReportById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const report = await reportsDb.report.findFirst({
        where: {
          id,
          OR: [
            { authorId: req.user.id },
            { isPublic: true },
            {
              collaborators: {
                some: { userId: req.user.id }
              }
            }
          ]
        },
        include: {
          collaborators: true,
          comments: {
            include: {
              replies: true
            },
            orderBy: { createdAt: 'desc' }
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 10
          },
          parentReport: {
            select: { id: true, title: true }
          },
          childReports: {
            select: { id: true, title: true, status: true }
          }
        }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      // Get author data from main database
      const author = await prisma.user.findUnique({
        where: { id: report.authorId },
        select: { id: true, name: true, email: true, role: true }
      });

      const response: ReportWithRelations = {
        ...report,
        author: author ?? undefined
      };

      res.json({ data: response });
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }

  // PUT /reports/:id
  async updateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateReportDTO = req.body;

      // Check if user has permission to edit
      const existingReport = await reportsDb.report.findFirst({
        where: {
          id,
          OR: [
            { authorId: req.user.id },
            {
              collaborators: {
                some: {
                  userId: req.user.id,
                  role: { in: ['EDITOR', 'ADMIN'] }
                }
              }
            }
          ]
        }
      });

      if (!existingReport) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      // Create version history
      const latestVersion = await reportsDb.reportVersion.findFirst({
        where: { reportId: id },
        orderBy: { version: 'desc' }
      });

      const newVersion = (latestVersion?.version ?? 0) + 1;

      await reportsDb.reportVersion.create({
        data: {
          reportId: id,
          version: newVersion,
          title: existingReport.title,
          description: existingReport.description,
          content: existingReport.content,
          changes: 'Updated via API',
          createdById: req.user.id,
          createdByEmail: req.user.email,
          createdByName: req.user.name
        }
      });

      // Update the report
      const updatedReport = await reportsDb.report.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        include: {
          collaborators: true,
          comments: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 5
          }
        }
      });

      res.json({
        message: 'Report updated successfully',
        data: updatedReport
      });
    } catch (error) {
      console.error('Error updating report:', error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  }

  // DELETE /reports/:id
  async deleteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const report = await reportsDb.report.findFirst({
        where: {
          id,
          authorId: req.user.id // Only author can delete
        }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      await reportsDb.report.delete({
        where: { id }
      });

      res.json({ message: 'Report deleted successfully' });
    } catch (error) {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }

  // POST /reports/:id/collaborators
  async addCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, role = 'VIEWER' } = req.body;

      // Check if user owns the report
      const report = await reportsDb.report.findFirst({
        where: { id, authorId: req.user.id }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      // Get user data from main database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const collaborator = await reportsDb.reportCollaborator.create({
        data: {
          reportId: id,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          role
        }
      });

      res.status(201).json({
        message: 'Collaborator added successfully',
        data: collaborator
      });
    } catch (error) {
      console.error('Error adding collaborator:', error);
      res.status(500).json({ error: 'Failed to add collaborator' });
    }
  }

  // POST /reports/:id/comments
  async addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, parentCommentId } = req.body;

      // Check if user has access to the report
      const report = await reportsDb.report.findFirst({
        where: {
          id,
          OR: [
            { authorId: req.user.id },
            { isPublic: true },
            {
              collaborators: {
                some: { userId: req.user.id }
              }
            }
          ]
        }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      const comment = await reportsDb.reportComment.create({
        data: {
          content,
          reportId: id,
          authorId: req.user.id,
          authorEmail: req.user.email,
          authorName: req.user.name,
          parentCommentId
        },
        include: {
          replies: true
        }
      });

      res.status(201).json({
        message: 'Comment added successfully',
        data: comment
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }
}

export default new ReportController();