import express from "express";
import reportController from "../controllers/report.controller";
import { authenticate } from "../middleware/auth";
import { validate,validateQuery } from "../middleware/validate"; // Fixed path (removed 'src')
import {
  createReportSchema,
  updateReportSchema,
  reportQuerySchema,
} from "../validations/report.validation";

const router = express.Router();


router.get("/",authenticate,validate(reportQuerySchema), reportController.getAllReports,);

router.post("/", authenticate, validate(createReportSchema), reportController.createReport );

router.get( "/my-reports", authenticate, validateQuery(reportQuerySchema), reportController.getMyReports);

router.get("/:id", authenticate, reportController.getReportById);

router.put("/:id", authenticate, validate(updateReportSchema), reportController.updateReport);

router.delete("/:id", authenticate, reportController.deleteReport);

// Additional report endpoints
router.get("/program/:programId", authenticate, validate(reportQuerySchema), reportController.getReportsByProgram);

router.get("/submission/:submissionId",authenticate,reportController.getReportsBySubmission);

router.put("/:id/publish", authenticate, reportController.publishReport);

export default router;
