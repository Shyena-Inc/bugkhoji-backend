import { Router } from "express";
import { getUserProfile,} from "../controllers/user.controller";

const router = Router();



router.route("/getUserProfile/:id").get( getUserProfile);

export default router;