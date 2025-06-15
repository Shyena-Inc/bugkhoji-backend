// controllers/programController.ts
import { Request, Response } from "express";

export class ProgramController {
  
  // Create a new program
  static async createProgram(req: Request, res: Response): Promise<void> {
    try {
      const {
        title,
        description,
        software_name,
        software_version,
        scope,
        out_of_scope,
        rewards,
        submission_guidelines,
        disclosure_policy,
        start_date,
        end_date,
        status = "DRAFT"
      } = req.body;

      const newProgram = {
        id: Date.now(), // Replace with proper ID generation
        organization_id: req.user?.id ?? null,
        title,
        description,
        software_name,
        software_version,
        scope,
        out_of_scope,
        rewards,
        submission_guidelines,
        disclosure_policy,
        start_date,
        end_date,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // TODO: Save to database
      // const savedProgram = await ProgramService.create(newProgram);

      res.status(201).json({
        message: "Bug bounty program created successfully",
        program: newProgram
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to create program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get all programs for organization
  static async getPrograms(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Fetch from database
      const programs = [
        {
          id: 1,
          organization_id: req.user?.id ?? null,
          title: "Web Application Security Test",
          software_name: "MyApp Web Portal",
          status: "ACTIVE",
          created_at: "2024-01-15T10:30:00Z"
        }
      ];

      res.json({
        message: "Programs retrieved successfully",
        programs
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to retrieve programs", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get program by ID
  static async getProgramById(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      
      // TODO: Fetch from database with ownership check
      const program = {
        id: programId,
        organization_id: req.user?.id ?? null,
        title: "Web Application Security Test",
        description: "Find vulnerabilities in our web application",
        software_name: "MyApp Web Portal",
        software_version: "v2.1.0",
        scope: "web application, API endpoints, authentication system",
        out_of_scope: "social engineering, physical attacks, DoS attacks",
        rewards: {
          critical: "$1000-$5000",
          high: "$500-$1000",
          medium: "$100-$500",
          low: "$50-$100"
        },
        submission_guidelines: "Provide detailed steps to reproduce the vulnerability",
        disclosure_policy: "90-day coordinated disclosure",
        start_date: "2024-02-01T00:00:00Z",
        end_date: "2024-05-01T23:59:59Z",
        status: "ACTIVE",
        created_at: "2024-01-15T10:30:00Z"
      };

      if (!program) {
        res.status(404).json({ message: "Program not found" });
        return;
      }

      res.json({
        message: "Program retrieved successfully",
        program
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to retrieve program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Update program
  static async updateProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      const updates = req.body;

      // TODO: Update in database with ownership check
      const updatedProgram = {
        id: programId,
        organization_id: req.user?.id ?? null,
        ...updates,
        updated_at: new Date().toISOString()
      };

      res.json({
        message: "Program updated successfully",
        program: updatedProgram
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to update program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Delete program
  static async deleteProgram(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;

      // TODO: Delete from database with ownership check
      // await ProgramService.delete(programId, req.user.id);

      res.json({
        message: "Program deleted successfully"
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to delete program", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Update program status
  static async updateProgramStatus(req: Request, res: Response): Promise<void> {
    try {
      const programId = req.params.id;
      const { status } = req.body;

      // TODO: Update status in database with ownership check
      const updatedProgram = {
        id: programId,
        status,
        updated_at: new Date().toISOString()
      };

      res.json({
        message: "Program status updated successfully",
        program: updatedProgram
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to update program status", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}