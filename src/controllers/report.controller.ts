import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  CreateReportDTO,
  UpdateReportDTO,
  ReportQueryParams,
  ReportWithAuthor,
  PaginationResponse,
  ReportStatus,
  ReportType,
  Priority,
} from '../types/report';
import { number } from 'joi';

class ReportController {
  constructor() {
    // Bind all methods to maintain 'this' context
    this.getAllReports = this.getAllReports.bind(this);
    this.createReport = this.createReport.bind(this);
    this.getReportById = this.getReportById.bind(this);
    this.updateReport = this.updateReport.bind(this);
    this.deleteReport = this.deleteReport.bind(this);
    this.publishReport = this.publishReport.bind(this);
    this.getReportsByProgram = this.getReportsByProgram.bind(this);
    this.getReportsBySubmission = this.getReportsBySubmission.bind(this);
    this.getMyReports = this.getMyReports.bind(this);
  }

  // Error handler
  private handleError(res: Response, error: unknown, context: string) {
    logger.error(`Error in ${context}:`, error);
    res.status(500).json({ error: `Failed to ${context}` });
  }

  // Authorization check
  private checkAuthorization(req: Request, res: Response): boolean {
    if (!req.user) {
      logger.warn('Unauthorized access attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  // Pagination setup
  private getPaginationParams(query: any) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  // Report includes for queries
  private getReportIncludes() {
    return {
      author: { select: { id: true, name: true, email: true, role: true } },
      program: { select: { id: true, title: true } },
      submission: { select: { id: true, title: true } }
    };
  }

  // Safe enum conversion
  private toReportStatus(status?: string): ReportStatus {
    if (status && Object.values(ReportStatus).includes(status as ReportStatus)) {
      return status as ReportStatus;
    }
    return ReportStatus.DRAFT;
  }

  private toReportType(type?: string): ReportType {
    if (type && Object.values(ReportType).includes(type as ReportType)) {
      return type as ReportType;
    }
    return ReportType.GENERAL;
  }

  private toPriority(priority?: string): Priority {
    if (priority && Object.values(Priority).includes(priority as Priority)) {
      return priority as Priority;
    }
    return Priority.MEDIUM;
  }

  // Format report response
  private formatReport(report: any): ReportWithAuthor {
    return {
      id: report.id,
      title: report.title,
      description: report.description,
      content: report.content,
      status: report.status,
      type: report.type,
      priority: report.priority,
      authorId: report.authorId,
      authorEmail: report.author?.email || '',
      authorName: report.author?.name || '',
      programId: report.programId,
      submissionId: report.submissionId,
      tags: report.tags || [],
      isPublic: report.isPublic,
      metadata: report.metadata || {},
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      author: report.author,
      collaborators: [],
      comments: [],
      childReports: []
    };
  }

  // Create pagination response
  private createPaginationResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginationResponse<T> {
    return {
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      }
    };
  }

  // CREATE
  async createReport(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to create report`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const dto: CreateReportDTO = {
        ...req.body,
        status: this.toReportStatus(req.body.status),
        type: this.toReportType(req.body.type),
        priority: this.toPriority(req.body.priority)
      };

      const report = await prisma.report.create({
        data: {
          title: dto.title,
          description: dto.description,
          content: dto.content || '',
          status: dto.status,
          type: dto.type,
          priority: dto.priority,
          authorId: req.user.id,
          programId: +dto.programId!,
          submissionId: +dto.submissionId!,
          tags: dto.tags || [],
          isPublic: dto.isPublic || false,
          metadata: dto.metadata || {},
          attachments: dto.attachments || []
        },
        include: this.getReportIncludes()
      });

      res.status(201).json({
        message: 'Report created successfully',
        data: this.formatReport(report)
      });
    } catch (error) {
      this.handleError(res, error, 'create report');
    }
  }

  async getAllReports(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;

      if (!req.user) {
        logger.warn(`Unauthorized attempt to get reports`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const query = req.query as ReportQueryParams;
      const { page, limit, skip } = this.getPaginationParams(query);

      const where = {
        AND: [
          {
            OR: [
              { authorId: req.user.id },
              { isPublic: true }
            ]
          },
          ...(query.search ? [{
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } }
            ]
          }] : []),
          ...(query.status ? [{ status: this.toReportStatus(query.status) }] : []),
          ...(query.type ? [{ type: this.toReportType(query.type) }] : []),
          ...(query.priority ? [{ priority: this.toPriority(query.priority) }] : []),
          ...(query.programId ? [{ programId: query.programId }] : []),
          ...(query.submissionId ? [{ submissionId: query.submissionId }] : []),
          ...(query.isPublic ? [{ isPublic: query.isPublic === 'true' }] : []),
          ...(query.tags ? [{
            tags: { hasSome: query.tags.split(',').map(tag => tag.trim()) }
          }] : []),
        ]
      };

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where:{

          },
          include: this.getReportIncludes(),
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.report.count({ where:{

        } })
      ]);

      const response = this.createPaginationResponse(
        reports.map(report => this.formatReport(report)),
        total,
        page,
        limit
      );

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'fetch reports');
    }
  }

  // READ (Single)
  async getReportById(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to get report`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const report = await prisma.report.findFirst({
        where: {
          id:+id,
          OR: [
            { authorId: req.user.id },
            { isPublic: true }
          ]
        },
        include: this.getReportIncludes()
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json({ data: this.formatReport(report) });
    } catch (error) {
      this.handleError(res, error, 'fetch report');
    }
  }

  // UPDATE
  async updateReport(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to update report`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const existingReport = await prisma.report.findFirst({
        where: { id:+id, authorId: req.user.id }
      });

      if (!existingReport) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      const updateData: UpdateReportDTO = {
        ...req.body,
        ...(req.body.status && { status: this.toReportStatus(req.body.status) }),
        ...(req.body.type && { type: this.toReportType(req.body.type) }),
        ...(req.body.priority && { priority: this.toPriority(req.body.priority) })
      };

      const updatedReport = await prisma.report.update({
        where: { id:+id },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        include: this.getReportIncludes()
      });

      res.json({
        message: 'Report updated successfully',
        data: this.formatReport(updatedReport)
      });
    } catch (error) {
      this.handleError(res, error, 'update report');
    }
  }

  // DELETE
  async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to delete report`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const report = await prisma.report.findFirst({
        where: { id:+id, authorId: req.user.id }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      await prisma.report.delete({ where: { id:+id } });

      res.json({ message: 'Report deleted successfully' });
    } catch (error) {
      this.handleError(res, error, 'delete report');
    }
  }

  // PUBLISH
  async publishReport(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to publish report`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const report = await prisma.report.findFirst({
        where: { id:+id, authorId: req.user.id }
      });

      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied' });
        return;
      }

      const updatedReport = await prisma.report.update({
        where: { id:+id },
        data: {
          status: ReportStatus.PUBLISHED,
          isPublic: true,
          publishedAt: new Date(),
          updatedAt: new Date()
        },
        include: this.getReportIncludes()
      });

      res.json({
        message: 'Report published successfully',
        data: this.formatReport(updatedReport)
      });
    } catch (error) {
      this.handleError(res, error, 'publish report');
    }
  }

  // GET BY PROGRAM
  async getReportsByProgram(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to get reports by program`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { programId } = req.params;
      const { page, limit, skip } = this.getPaginationParams(req.query);

      const where = {
        programId,
        OR: [
          { authorId: req.user.id },
          { isPublic: true }
        ]
      };

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where:{},
          include: this.getReportIncludes(),
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.report.count({ where:{} })
      ]);

      const response = this.createPaginationResponse(
        reports.map(report => this.formatReport(report)),
        total,
        page,
        limit
      );

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'fetch reports by program');
    }
  }

  // GET BY SUBMISSION
  async getReportsBySubmission(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to get reports by submission`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { submissionId } = req.params;
      const reports = await prisma.report.findMany({
        where: {
          submissionId:+submissionId,
          OR: [
            { authorId: req.user.id },
            { isPublic: true }
          ]
        },
        include: this.getReportIncludes(),
        orderBy: { createdAt: 'desc' }
      });

      res.json({ 
        data: reports.map(report => this.formatReport(report)) 
      });
    } catch (error) {
      this.handleError(res, error, 'fetch reports by submission');
    }
  }

  // GET USER REPORTS
  async getMyReports(req: Request, res: Response): Promise<void> {
    try {
      if (!this.checkAuthorization(req, res)) return;
      
      if (!req.user) {
        logger.warn(`Unauthorized attempt to get my reports`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const { status, type } = req.query;
      const { page, limit, skip } = this.getPaginationParams(req.query);

      const where: any = { authorId: req.user.id };
      if (status) where.status = this.toReportStatus(status as string);
      if (type) where.type = this.toReportType(type as string);

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          include: this.getReportIncludes(),
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.report.count({ where })
      ]);

      const response = this.createPaginationResponse(
        reports.map(report => this.formatReport(report)),
        total,
        page,
        limit
      );

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'fetch my reports');
    }
  }
}

export default new ReportController();