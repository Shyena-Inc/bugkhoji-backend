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
    websiteName,
    scope,
    rewards
  } = req.body;

  const missingFields = [];
  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");
  if (!websiteName) missingFields.push("websiteName");
  if (!scope || (Array.isArray(scope) && scope.length === 0)) missingFields.push("scope");
  if (!rewards || Object.keys(rewards).length === 0) missingFields.push("rewards");

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
  const { startDate, endDate } = req.body;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        message: "Invalid date format. Please use ISO 8601 format (YYYY-MM-DD)"
      });
      return;
    }

    if (start >= end) {
      res.status(400).json({
        message: "Start date must be before end date"
      });
      return;
    }

    // Allow past dates for flexibility (remove this check if needed)
    // if (start < new Date()) {
    //   res.status(400).json({
    //     message: "Start date cannot be in the past"
    //   });
    //   return;
    // }
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

  const validLevels = ["critical", "high", "medium", "low"];
  const providedLevels = Object.keys(rewards);

  // Check if at least one valid reward level is provided
  const hasValidLevel = providedLevels.some(level => validLevels.includes(level) && rewards[level]);

  if (!hasValidLevel) {
    res.status(400).json({
      message: `At least one reward level must be provided. Valid levels: ${validLevels.join(", ")}`
    });
    return;
  }

  // Validate that provided levels are valid
  const invalidLevels = providedLevels.filter(level => !validLevels.includes(level));
  if (invalidLevels.length > 0) {
    res.status(400).json({
      message: `Invalid reward levels: ${invalidLevels.join(", ")}. Valid levels: ${validLevels.join(", ")}`
    });
    return;
  }

  next();
};
