// controllers/programController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class ProgramController {
  
  // Create a new program (organization only)
  static async createProgram(req: Request, res: Response): Promise<void> {
    try {
      const {
        title,
        description,
        websiteName,
        websiteUrls,
        scope,
        outOfScope,
        rewards,
        submissionGuidelines,
        disclosurePolicy,
        startDate,
        endDate,
        status = "DRAFT"
      } = req.body;

      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found. Please create an organization first." });
        return;
      }

      const newProgram = await prisma.program.create({
        data: {
          title,
          description,
          websiteName,
          websiteUrls: Array.isArray(websiteUrls) ? websiteUrls : [websiteUrls].filter(Boolean),
          scope,
          outOfScope,
          rewards: rewards || {},
          submissionGuidelines,
          disclosurePolicy,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          status,
          organizationId: organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      res.status(201).json({
        message: "Bug bounty program created successfully",
        program: newProgram
      });
    } catch (error) {
      console.error("Error creating program:", error);
      res.status(500).json({ 
        message: "Failed to create program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get all programs for organization (owner only)
  static async getPrograms(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
      }

      const programs = await prisma.program.findMany({
        where: {
          organizationId: organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              submissions: true,
              reports: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        message: "Programs retrieved successfully",
        programs
      });
    } catch (error) {
      console.error("Error retrieving programs:", error);
      res.status(500).json({ 
        message: "Failed to retrieve programs", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get program by ID (owner only)
  static async getProgramById(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
      }

      const program = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId: organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              website: true
            }
          },
          submissions: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
              researcherEmail: true,
              researcherName: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          reports: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true,
              priority: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              submissions: true,
              reports: true
            }
          }
        }
      });

      if (!program) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      res.json({
        message: "Program retrieved successfully",
        program
      });
    } catch (error) {
      console.error("Error retrieving program:", error);
      res.status(500).json({ 
        message: "Failed to retrieve program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Update program (owner only)
  static async updateProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      const {
        title,
        description,
        websiteName,
        websiteUrls,
        scope,
        outOfScope,
        rewards,
        submissionGuidelines,
        disclosurePolicy,
        startDate,
        endDate,
        status
      } = req.body;

      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
      }

      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId: organization.id
        }
      });

      if (!existingProgram) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (websiteName !== undefined) updateData.websiteName = websiteName;
      if (websiteUrls !== undefined) updateData.websiteUrls = Array.isArray(websiteUrls) ? websiteUrls : [websiteUrls].filter(Boolean);
      if (scope !== undefined) updateData.scope = scope;
      if (outOfScope !== undefined) updateData.outOfScope = outOfScope;
      if (rewards !== undefined) updateData.rewards = rewards;
      if (submissionGuidelines !== undefined) updateData.submissionGuidelines = submissionGuidelines;
      if (disclosurePolicy !== undefined) updateData.disclosurePolicy = disclosurePolicy;
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (status !== undefined) updateData.status = status;

      const updatedProgram = await prisma.program.update({
        where: { id: programId },
        data: updateData,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      res.json({
        message: "Program updated successfully",
        program: updatedProgram
      });
    } catch (error) {
      console.error("Error updating program:", error);
      res.status(500).json({ 
        message: "Failed to update program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Delete program (owner only)
  static async deleteProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;

      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
      }

      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId: organization.id
        }
      });

      if (!existingProgram) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      await prisma.program.delete({
        where: { id: programId }
      });

      res.json({
        message: "Program deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting program:", error);
      res.status(500).json({ 
        message: "Failed to delete program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Update program status (owner only)
  static async updateProgramStatus(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      const { status } = req.body;

      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ 
          message: "Invalid status", 
          validStatuses 
        });
        return;
      }

      const organization = await prisma.organization.findUnique({
        where: { userId: req.user.id }
      });

      if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
      }

      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId: organization.id
        }
      });

      if (!existingProgram) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      const updatedProgram = await prisma.program.update({
        where: { id: programId },
        data: { status },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      res.json({
        message: "Program status updated successfully",
        program: updatedProgram
      });
    } catch (error) {
      console.error("Error updating program status:", error);
      res.status(500).json({ 
        message: "Failed to update program status", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================
  // NEW methods for researchers
  // ============================

  // Researchers: Get all programs (no ownership restriction)
  static async getAllProgramsForResearchers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const programs = await prisma.program.findMany({
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              website: true,
              // email: true
            }
          },
          _count: {
            select: {
              submissions: true,
              reports: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      res.json({
        message: "Programs retrieved successfully",
        programs
      });
    } catch (error) {
      console.error("Error retrieving programs for researchers:", error);
      res.status(500).json({
        message: "Failed to retrieve programs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Researchers: Get program by ID (no ownership restriction)
  static async getProgramByIdForResearchers(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;

      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              website: true,
              // email: true
            }
          },
          submissions: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
              researcherEmail: true,
              researcherName: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          reports: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true,
              priority: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              submissions: true,
              reports: true
            }
          }
        }
      });

      if (!program) {
        res.status(404).json({ message: "Program not found" });
        return;
      }

      res.json({
        message: "Program retrieved successfully",
        program
      });
    } catch (error) {
      console.error("Error retrieving program by ID for researchers:", error);
      res.status(500).json({
        message: "Failed to retrieve program",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
