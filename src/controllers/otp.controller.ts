import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { Mailer } from "../utils/mailer";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

// Helper: Generate random 6-digit OTP
const generateOTP = (): string => Math.floor(100000 + Math.random() * 900000).toString();

// Controller: Send OTP
export const sendOTP = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is missing"
      });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid email address" 
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins from now

    try {
      // Delete any existing OTPs for this email
      await prisma.otp.deleteMany({
        where: { email }
      });

      // Save new OTP to DB
      const newOtp = await prisma.otp.create({
        data: { 
          email, 
          code: otp, 
          expiresAt,
          createdAt: new Date()
        },
      });

      if (!newOtp) {
        logger.error("Failed to create OTP record", { email });
        return res.status(500).json({ 
          success: false, 
          message: "Failed to generate OTP" 
        });
      }

      // Send via Mailjet
      const emailResult = await Mailer(email, otp);
      
      if (!emailResult.success) {
        logger.error("Failed to send OTP email", { 
          email, 
          error: emailResult.error 
        });
        return res.status(500).json({ 
          success: false, 
          message: "Failed to send OTP email" 
        });
      }

      logger.info("OTP sent successfully", { 
        email, 
      });

      return res.json({ 
        success: true, 
        message: "OTP sent successfully" 
      });

    } catch (err) {
      logger.error("Error sending OTP", { 
        email, 
        error: err instanceof Error ? err.message : String(err), 
        stack: err instanceof Error ? err.stack : undefined 
      });
      
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send OTP" 
      });
    }
  } catch (err) {
    logger.error("Error in sendOTP", {
      error: err instanceof Error ? err.message : String(err),
      body: req.body
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Controller: Verify OTP
export const verifyOTP = async (req: Request, res: Response): Promise<Response> => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ 
      success: false, 
      message: "Email and OTP are required" 
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please provide a valid email address" 
    });
  }

  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ 
      success: false, 
      message: "OTP must be a 6-digit number" 
    });
  }

  try {
    const record = await prisma.otp.findFirst({
      where: { 
        email, 
        code: otp 
      },
      orderBy: { 
        createdAt: "desc" 
      },
    });

    if (!record) {
      logger.warn("Invalid OTP attempt", { email, otp });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP" 
      });
    }

    if (new Date() > record.expiresAt) {
      logger.warn("Expired OTP attempt", { 
        email, 
        otp, 
        expiresAt: record.expiresAt 
      });
      
      // Clean up expired OTP
      await prisma.otp.delete({ 
        where: { id: record.id } 
      });
      
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // Delete the used OTP to prevent reuse
    await prisma.otp.delete({ 
      where: { id: record.id } 
    });

    logger.info("OTP verified successfully", { email });

    return res.json({ 
      success: true, 
      message: "OTP verified successfully" 
    });

  } catch (err) {
    logger.error("Error verifying OTP", { 
      email, 
      error: err instanceof Error ? err.message : String(err), 
      stack: err instanceof Error ? err.stack : undefined 
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "Failed to verify OTP" 
    });
  }
};

// Controller: Resend OTP
export const resendOTP = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: "Email is required" 
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please provide a valid email address" 
    });
  }

  try {
    // Check if there's a recent OTP request (prevent spam)
    const recentOTP = await prisma.otp.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (recentOTP) {
      const timeSinceLastRequest = Date.now() - recentOTP.createdAt.getTime();
      const cooldownPeriod = 60 * 1000; // 1 minute cooldown
      
      if (timeSinceLastRequest < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000);
        return res.status(429).json({ 
          success: false, 
          message: `Please wait ${remainingTime} seconds before requesting a new OTP` 
        });
      }
    }

    // Generate new OTP and proceed with sending
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete existing OTPs
    await prisma.otp.deleteMany({
      where: { email }
    });

    // Create new OTP
    await prisma.otp.create({
      data: { 
        email, 
        code: otp, 
        expiresAt,
        createdAt: new Date()
      },
    });

    // Send via Mailjet
    const emailResult = await Mailer(email, otp);
    
    if (!emailResult.success) {
      logger.error("Failed to resend OTP email", { 
        email, 
        error: emailResult.error 
      });
      return res.status(500).json({ 
        success: false, 
        message: "Failed to resend OTP email" 
      });
    }

    logger.info("OTP resent successfully", { 
      email, 
    });

    return res.json({ 
      success: true, 
      message: "OTP resent successfully" 
    });

  } catch (err) {
    logger.error("Error resending OTP", { 
      email, 
      error: err instanceof Error ? err.message : String(err), 
      stack: err instanceof Error ? err.stack : undefined 
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "Failed to resend OTP" 
    });
  }
};