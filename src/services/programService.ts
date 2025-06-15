// services/programService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ProgramService {
  
  // Create a new program
  static async createProgram(organizationId: string, programData: any) {
    try {
      const program = await prisma.program.create({
        data: {
          organizationId,
          title: programData.title,
          description: programData.description,
          websiteName: programData.website_name,
          websiteUrls: programData.website_urls,
          scope: programData.scope,
          outOfScope: programData.out_of_scope,
          rewards: programData.rewards,
          submissionGuidelines: programData.submission_guidelines,
          disclosurePolicy: programData.disclosure_policy,
          startDate: programData.start_date ? new Date(programData.start_date) : null,
          endDate: programData.end_date ? new Date(programData.end_date) : null,
          status: programData.status || 'DRAFT',
        },
      });
      return program;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create program: ${error.message}`);
      }
      throw new Error('Failed to create program: Unknown error');
    }
  }

  // Get all programs for an organization
  static async getProgramsByOrganization(organizationId: string) {
    try {
      const programs = await prisma.program.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          websiteName: true,
          websiteUrls: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return programs;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch programs: ${error.message}`);
      }
      throw new Error('Failed to fetch programs: Unknown error');
    }
  }

  // Get a single program by ID (with ownership check)
  static async getProgramById(programId: string, organizationId: string) {
    try {
      const program = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId,
        },
      });
      
      if (!program) {
        throw new Error('Program not found or access denied');
      }
      
      return program;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch program: ${error.message}`);
      }
      throw new Error('Failed to fetch program: Unknown error');
    }
  }

  // Update a program
  static async updateProgram(programId: string, organizationId: string, updateData: any) {
    try {
      // First check if program exists and belongs to organization
      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId,
        },
      });

      if (!existingProgram) {
        throw new Error('Program not found or access denied');
      }

      const updatedProgram = await prisma.program.update({
        where: {
          id: programId,
        },
        data: {
          ...(updateData.title && { title: updateData.title }),
          ...(updateData.description && { description: updateData.description }),
          ...(updateData.website_name && { websiteName: updateData.website_name }),
          ...(updateData.website_urls && { websiteUrls: updateData.website_urls }),
          ...(updateData.scope && { scope: updateData.scope }),
          ...(updateData.out_of_scope && { outOfScope: updateData.out_of_scope }),
          ...(updateData.rewards && { rewards: updateData.rewards }),
          ...(updateData.submission_guidelines && { submissionGuidelines: updateData.submission_guidelines }),
          ...(updateData.disclosure_policy && { disclosurePolicy: updateData.disclosure_policy }),
          ...(updateData.start_date && { startDate: new Date(updateData.start_date) }),
          ...(updateData.end_date && { endDate: new Date(updateData.end_date) }),
          ...(updateData.status && { status: updateData.status }),
          updatedAt: new Date(),
        },
      });

      return updatedProgram;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update program: ${error.message}`);
      }
      throw new Error('Failed to update program: Unknown error');
    }
  }

  // Delete a program
  static async deleteProgram(programId: string, organizationId: string) {
    try {
      // First check if program exists and belongs to organization
      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId,
        },
      });

      if (!existingProgram) {
        throw new Error('Program not found or access denied');
      }

      await prisma.program.delete({
        where: {
          id: programId,
        },
      });

      return { message: 'Program deleted successfully' };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete program: ${error.message}`);
      }
      throw new Error('Failed to delete program: Unknown error');
    }
  }

  // Update program status
  static async updateProgramStatus(programId: string, organizationId: string, status: string) {
    try {
      // First check if program exists and belongs to organization
      const existingProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          organizationId,
        },
      });

      if (!existingProgram) {
        throw new Error('Program not found or access denied');
      }

      const updatedProgram = await prisma.program.update({
        where: {
          id: programId,
        },
        data: {
          status: status as any, // Cast to any to bypass type error, or import and use ProgramStatus enum if available
          updatedAt: new Date(),
        },
      });

      return updatedProgram;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update program status: ${error.message}`);
      }
      throw new Error('Failed to update program status: Unknown error');
    }
  }

  // Get public programs (for researchers to view)
  static async getPublicPrograms() {
    try {
      const programs = await prisma.program.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          description: true,
          websiteName: true,
          websiteUrls: true,
          scope: true,
          outOfScope: true,
          rewards: true,
          submissionGuidelines: true,
          disclosurePolicy: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return programs;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch public programs: ${error.message}`);
      }
      throw new Error('Failed to fetch public programs: Unknown error');
    }
  }
}