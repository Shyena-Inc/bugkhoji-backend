import { PrismaClient } from "@prisma/client";
import { ApiError, ApiResponse } from "../utils/ApiBase";
import { Request, Response } from "express";

const prisma = new PrismaClient();

const getUserProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const userID =  req.user?.id;
    
    if (!userID) {
      throw new ApiError(401, "User not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userID
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      
      }
    });
    
    console.log("Found user:", user ? "Yes" : "No"); 
      
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, "User profile fetched successfully", user));
  } catch (error) {
    console.error("Error in getUserProfile:", error); // Debug log
    
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, error.message, null));
    }
    
    return res
      .status(500)
      .json(new ApiResponse(500, "Internal server error", null));
  }
};

export {
  getUserProfile,
};