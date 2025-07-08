import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { rateLimiting } from "../middleware/ratelimiter";
import { getSessions } from "../controllers/session.controller";
import { authenticateToken } from "../middleware/authenticateToken";
import {
  registerResearcher,
  registerOrganization,
  login,
  refreshToken,
  logout,
} from "../controllers/auth.controller";
import {
  loginSchema,
  registerSchema,
  organizationRegisterSchema,
} from "../schemas/auth.schemas";

const router = Router();

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
  keyGenerator: (req) => {
    const email = req.body?.email || "unknown";
    return `${req.ip}-${email}`;
  },
});

// ============================================================================
// REGISTRATION ROUTES
// ============================================================================

/**
 * 🔐 Researcher Registration
 */
router.post(
  "/register/researcher",
  authLimiter,
  validate(registerSchema),
  registerResearcher
);

/**
 * 🏢 Organization Registration
 */
router.post(
  "/register/organization",
  authLimiter,
  validate(organizationRegisterSchema),
  registerOrganization
);

// ============================================================================
// LOGIN ROUTES
// ============================================================================

/**
 * 🔐 Researcher Login
 */
router.post(
  "/login/researcher",
  authLimiter,
  validate(loginSchema),
  (req, res) => {
    req.body.userType = "RESEARCHER";
    login(req, res);
  }
);

/**
 * 🔐 Admin Login
 */
router.post(
  "/login/admin",
  authLimiter,
  validate(loginSchema),
  (req, res) => {
    req.body.userType = "ADMIN";
    login(req, res);
  }
);

/**
 * 🏢 Organization Login
 */
router.post(
  "/login/organization",
  authLimiter,
  validate(loginSchema),
  (req, res) => {
    req.body.userType = "ORGANIZATION";
    login(req, res);
  }
);

// ============================================================================
// TOKEN MANAGEMENT ROUTES
// ============================================================================

/**
 * 🔐 Refresh Token
 */
router.post("/refresh",authenticateToken, refreshToken);

/**
 * 🔐 Logout
 */
router.post("/logout", authenticate, logout);

// ============================================================================
// SESSION MANAGEMENT ROUTES
// ============================================================================

/**
 * 🔐 Get User Sessions
 */
router.get("/sessions", rateLimiting, authenticate, getSessions);

// ============================================================================
// PLACEHOLDER ROUTES
// ============================================================================

/**
 * 📧 Email Opt-in/out (placeholder)
 */
router.post("/mail-opt", async (req, res) => {
  try {
    // TODO: Implement email opt-in/out logic in controller
    res.status(200).json({ message: "Email preferences updated" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
});

export default router;