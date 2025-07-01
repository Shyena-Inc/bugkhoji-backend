import User from "../models/user.model";
import { ApiError, ApiResponse } from "../utils/ApiBase";
import { Request, Response } from "express";



const getUserProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const userID = req.params.id;
    if (!userID) throw new ApiError(400, "Please provide user ID");

    const user = await User.findById(userID)
      .select("-password -tokenVersion")
      .populate("streak", "-_id streak")
      .populate({
        path: "solvedChallenges",
        select: "-_id problems",
        options: { strictPopulate: false },
      });
    if (!user) throw new ApiError(404, "User not found");
    res
      .status(200)
      .json(new ApiResponse(200, "User profile fetched successfully", user));
  } catch (error) {
    return res
      .status( 500)
      .json(error);
  }
};

export {
  getUserProfile,
};