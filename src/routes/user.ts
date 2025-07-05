import { Router } from "express";
import { getUserProfile,} from "../controllers/user.controller";
import authenticate from "../middleware/authenticate";

const router = Router();

router.get("/profile", authenticate, getUserProfile);

export default router;