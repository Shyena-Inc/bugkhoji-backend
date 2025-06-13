import express from 'express';
import { sendOTP, verifyOTP, resendOTP } from "../controllers/otp.controller";
import { logger } from "../utils/logger";

const router = express.Router();

// Add error handling wrapper
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error('Route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  });
};

router.post('/send-otp', asyncHandler(sendOTP));
router.post('/verify-otp', asyncHandler(verifyOTP));
router.post('/resend-otp', asyncHandler(resendOTP));

export default router;