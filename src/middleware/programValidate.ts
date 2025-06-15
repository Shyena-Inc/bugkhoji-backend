// middleware/programValidation.ts
import { Request, Response, NextFunction } from "express";

// Validate program creation data
export const validateProgramData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const {
    title,
    description,
    software_name,
    scope,
    rewards
  } = req.body;

  const missingFields = [];
  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");
  if (!software_name) missingFields.push("software_name");
  if (!scope) missingFields.push("scope");
  if (!rewards) missingFields.push("rewards");

  if (missingFields.length > 0) {
    res.status(400).json({
      message: `Missing required fields: ${missingFields.join(", ")}`
    });
    return;
  }

  next();
};

// Validate program status
export const validateProgramStatus = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { status } = req.body;
  const validStatuses = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"];

  if (!status) {
    res.status(400).json({ message: "Status is required" });
    return;
  }

  if (!validStatuses.includes(status)) {
    res.status(400).json({
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
    });
    return;
  }

  next();
};

// Validate date ranges
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { start_date, end_date } = req.body;

  if (start_date && end_date) {
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (startDate >= endDate) {
      res.status(400).json({
        message: "Start date must be before end date"
      });
      return;
    }

    if (startDate < new Date()) {
      res.status(400).json({
        message: "Start date cannot be in the past"
      });
      return;
    }
  }

  next();
};

// Validate reward structure
export const validateRewards = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { rewards } = req.body;

  if (!rewards || typeof rewards !== "object") {
    res.status(400).json({
      message: "Rewards must be an object with severity levels"
    });
    return;
  }

  const requiredLevels = ["critical", "high", "medium", "low"];
  const missingLevels = requiredLevels.filter(level => !rewards[level]);

  if (missingLevels.length > 0) {
    res.status(400).json({
      message: `Missing reward levels: ${missingLevels.join(", ")}`
    });
    return;
  }

  next();
};