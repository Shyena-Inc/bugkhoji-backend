import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";  
import { deleteLogoFile, getLogoUrl } from "../utils/fileUpload";
import path from "path";

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

      // Validate arrays and ensure proper data types
      const processedWebsiteUrls = websiteUrls ? 
        (Array.isArray(websiteUrls) ? websiteUrls : [websiteUrls]).filter(url => url && url.trim()) 
        : [];
      
      const processedScope = scope ? 
        (Array.isArray(scope) ? scope : [scope]).filter(item => item && item.trim()) 
        : [];

      const newProgram = await prisma.program.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          websiteName: websiteName.trim(),
          websiteUrls: processedWebsiteUrls,
          scope: processedScope,
          outOfScope: outOfScope ? outOfScope.trim() : null,
          rewards: rewards || {},
          submissionGuidelines: submissionGuidelines ? submissionGuidelines.trim() : null,
          disclosurePolicy: disclosurePolicy ? disclosurePolicy.trim() : null,
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

      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
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

      if (!existingProgram) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      res.json({
        message: "Program retrieved successfully",
        program: existingProgram
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
        status,
        logo
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
        },
        select: {
          id: true,
          logo: true
        }
      });

      if (!existingProgram) {
        res.status(404).json({ message: "Program not found or access denied" });
        return;
      }

      const updateData: Prisma.ProgramUpdateInput = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (websiteName !== undefined) updateData.websiteName = websiteName.trim();
      if (websiteUrls !== undefined) {
        updateData.websiteUrls = websiteUrls ? 
          (Array.isArray(websiteUrls) ? websiteUrls : [websiteUrls]).filter(url => url && url.trim()) 
          : [];
      }
      if (scope !== undefined) {
        updateData.scope = scope ? 
          (Array.isArray(scope) ? scope : [scope]).filter(item => item && item.trim()) 
          : [];
      }
      if (outOfScope !== undefined) updateData.outOfScope = outOfScope ? outOfScope.trim() : null;
      if (rewards !== undefined) updateData.rewards = rewards;
      if (submissionGuidelines !== undefined) updateData.submissionGuidelines = submissionGuidelines ? submissionGuidelines.trim() : null;
      if (disclosurePolicy !== undefined) updateData.disclosurePolicy = disclosurePolicy ? disclosurePolicy.trim() : null;
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (status !== undefined) updateData.status = status;
      if (logo !== undefined) updateData.logo = logo;

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
              website: true
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

      res.json(programs);
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
        res.status(404).json({ message: "Program not found" });
        return;
      }

      res.json(program);
    } catch (error) {
      console.error("Error retrieving program by ID for researchers:", error);
      res.status(500).json({
        message: "Failed to retrieve program",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================
  // Researcher Program Participation methods
  // ============================

  // Join a program (researchers only)
  static async joinProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      // Only researchers can join programs
      if (req.user.role !== 'RESEARCHER') {
        res.status(403).json({ message: "Only researchers can join programs" });
        return;
      }

      // Check if the program exists
      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!program) {
        res.status(404).json({ message: "Program not found" });
        return;
      }

      // Check if program is active or available for joining
      if (program.status !== 'ACTIVE') {
        res.status(400).json({ 
          message: "Cannot join program", 
          reason: `Program status is ${program.status}. Only ACTIVE programs can be joined.` 
        });
        return;
      }

      // Check if user is already a participant
      const existingParticipant = await prisma.programParticipant.findUnique({
        where: {
          userId_programId: {
            userId: req.user.id,
            programId: programId
          }
        }
      });

      if (existingParticipant) {
        res.status(409).json({ message: "You are already participating in this program" });
        return;
      }

      // Create the participation record
      const participation = await prisma.programParticipant.create({
        data: {
          userId: req.user.id,
          programId: programId
        },
        include: {
          program: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      res.status(201).json({
        message: "Successfully joined the program",
        participation: participation
      });
    } catch (error) {
      console.error("Error joining program:", error);
      res.status(500).json({
        message: "Failed to join program",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Leave a program (researchers only)
  static async leaveProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      // Only researchers can leave programs
      if (req.user.role !== 'RESEARCHER') {
        res.status(403).json({ message: "Only researchers can leave programs" });
        return;
      }

      // Check if the program exists
      const program = await prisma.program.findUnique({
        where: { id: programId },
        select: {
          id: true,
          title: true,
          status: true
        }
      });

      if (!program) {
        res.status(404).json({ message: "Program not found" });
        return;
      }

      // Check if user is a participant
      const existingParticipant = await prisma.programParticipant.findUnique({
        where: {
          userId_programId: {
            userId: req.user.id,
            programId: programId
          }
        }
      });

      if (!existingParticipant) {
        res.status(404).json({ message: "You are not participating in this program" });
        return;
      }

      // Remove the participation record
      await prisma.programParticipant.delete({
        where: {
          id: existingParticipant.id
        }
      });

      res.json({
        message: "Successfully left the program",
        programTitle: program.title
      });
    } catch (error) {
      console.error("Error leaving program:", error);
      res.status(500).json({
        message: "Failed to leave program",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get joined programs for a researcher
  static async getJoinedPrograms(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      // Only researchers can view their joined programs
      if (req.user.role !== 'RESEARCHER') {
        res.status(403).json({ message: "Only researchers can view joined programs" });
        return;
      }

      const joinedPrograms = await prisma.programParticipant.findMany({
        where: {
          userId: req.user.id
        },
        include: {
          program: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  website: true
                }
              },
              _count: {
                select: {
                  participants: true,
                  submissions: true,
                  reports: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const programs = joinedPrograms.map(participation => ({
        ...participation.program,
        joinedAt: participation.createdAt
      }));

      res.json({
        message: "Joined programs retrieved successfully",
        programs: programs
      });
    } catch (error) {
      console.error("Error retrieving joined programs:", error);
      res.status(500).json({
        message: "Failed to retrieve joined programs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

//   // ============================
//   // Logo management methods
//   // ============================

//   // Upload program logo (organization only)
//   static async uploadProgramLogo(req: Request, res: Response): Promise<void> {
//     try {
//       const programId = req.params.id;
      
//       if (!req.user?.id) {
//         res.status(401).json({ message: "Authentication required" });
//         return;
//       }

//       if (!req.file) {
//         res.status(400).json({ message: "No image file provided" });
//         return;
//       }

//       const organization = await prisma.organization.findUnique({
//         where: { userId: req.user.id }
//       });

//       if (!organization) {
//         res.status(404).json({ message: "Organization not found" });
//         return;
//       }

//       const existingProgram = await prisma.program.findFirst({
//         where: {
//           id: programId,
//           organizationId: organization.id
//         },
//         include: {
//           organization: {
//             select: {
//               id: true,
//               name: true
//             }
//           }
//         }
//       });

//       if (!existingProgram) {
//         res.status(404).json({ message: "Program not found or access denied" });
//         return;
//       }

//       // Delete old logo if exists
//       if (existingProgram.logo) {
//         const oldLogoPath = path.join(process.cwd(), 'uploads', 'program-logos', path.basename(existingProgram.logo));
//         deleteLogoFile(oldLogoPath);
//       }

//       // Save new logo URL to database
//       const logoUrl = getLogoUrl(req.file.filename);
//       const updatedProgram = await prisma.program.update({
//         where: { id: programId },
//         data: { 
//           logo: logoUrl 
//         },
//         include: {
//           organization: {
//             select: {
//               id: true,
//               name: true
//             }
//           }
//         }
//       });

//       res.json({
//         message: "Program logo uploaded successfully",
//         program: updatedProgram,
//         logoUrl
//       });
//     } catch (error) {
//       console.error("Error uploading program logo:", error);
//       res.status(500).json({
//         message: "Failed to upload program logo",
//         error: error instanceof Error ? error.message : String(error)
//       });
//     }
//   }

//   // Delete program logo (organization only)
//   static async deleteProgramLogo(req: Request, res: Response): Promise<void> {
//     try {
//       const programId = req.params.id;
      
//       if (!req.user?.id) {
//         res.status(401).json({ message: "Authentication required" });
//         return;
//       }

//       const organization = await prisma.organization.findUnique({
//         where: { userId: req.user.id }
//       });

//       if (!organization) {
//         res.status(404).json({ message: "Organization not found" });
//         return;
//       }

//       const existingProgram = await prisma.program.findFirst({
//         where: {
//           id: programId,
//           organizationId: organization.id
//         }
//       });

//       if (!existingProgram) {
//         res.status(404).json({ message: "Program not found or access denied" });
//         return;
//       }

//       if (!existingProgram.logo) {
//         res.status(404).json({ message: "Program has no logo to delete" });
//         return;
//       }

//       // Delete logo file
//       const logoPath = path.join(process.cwd(), 'uploads', 'program-logos', path.basename(existingProgram.logo));
//       deleteLogoFile(logoPath);

//       // Remove logo URL from database
//       const updatedProgram = await prisma.program.update({
//         where: { id: programId },
//         data: { logo: null },
//         include: {
//           organization: {
//             select: {
//               id: true,
//               name: true
//             }
//           }
//         }
//       });

//       res.json({
//         message: "Program logo deleted successfully",
//         program: updatedProgram
//       });
//     } catch (error) {
//       console.error("Error deleting program logo:", error);
//       res.status(500).json({
//         message: "Failed to delete program logo",
//         error: error instanceof Error ? error.message : String(error)
//       });
//     }
//   }
}
