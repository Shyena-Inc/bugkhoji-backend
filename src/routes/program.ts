// routes/programRoutes.ts
import { Router } from "express";
import { requireActiveOrganization, requireOrganizationOrAdmin } from "../middleware/auth";
import authenticate from "../middleware/authenticate";
import {
  validateProgramData,
  validateProgramStatus,
  validateDateRange,
  validateRewards
} from "../middleware/programValidate";
import { ProgramController } from "../controllers/program.controller";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Existing org-only routes
router.get("/org-profile", requireActiveOrganization, (req, res) => {
  res.json({ message: "Organization profile access granted", user: req.user });
});

router.get("/manage-programs", requireOrganizationOrAdmin, (req, res) => {
  res.json({ message: "Manage programs access granted", user: req.user });
});

router.post(
  "/programs",
  requireActiveOrganization,
  validateProgramData,
  validateRewards,
  validateDateRange,
  ProgramController.createProgram
);

router.get(
  "/programs",
  requireActiveOrganization,
  ProgramController.getPrograms
);

router.get(
  "/programs/:id",
  requireActiveOrganization,
  ProgramController.getProgramById
);

router.put(
  "/programs/:id",
  requireActiveOrganization,
  validateDateRange,
  ProgramController.updateProgram
);

router.delete(
  "/programs/:id",
  requireActiveOrganization,
  ProgramController.deleteProgram
);

router.patch(
  "/programs/:id/status",
  requireActiveOrganization,
  validateProgramStatus,
  ProgramController.updateProgramStatus
);

// ==== New researcher read-only routes ====
// No org ownership required, just authenticated
router.get(
  "/researcher/programs",
  ProgramController.getAllProgramsForResearchers
);

router.get(
  "/researcher/programs/:id",
  ProgramController.getProgramByIdForResearchers
);

export default router;
