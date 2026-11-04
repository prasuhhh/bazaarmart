import { Router } from 'express';
import { googleSignIn, requestOtp, verifyOtp } from '../controllers/authController.js';

export function createAuthRoutes({ otpLimiters }) {
  const router = Router();
  router.post('/otp/request', otpLimiters, requestOtp);
  router.post('/otp/verify', verifyOtp);
  router.post('/google', googleSignIn);
  return router;
}
