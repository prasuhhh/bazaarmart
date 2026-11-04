import { Router } from 'express';
import { authenticate, authorizeEmail } from '../middleware/auth.js';
import { deleteAccount, login, patchProfile, register, updateProfile } from '../controllers/userController.js';

export function createUserRoutes({ loginLimiter, registerLimiter }) {
  const router = Router();
  router.post('/login', loginLimiter, login);
  router.post('/users', registerLimiter, register);
  router.put('/users', authenticate, authorizeEmail, updateProfile);
  router.patch('/users', authenticate, authorizeEmail, patchProfile);
  router.delete('/users', authenticate, authorizeEmail, deleteAccount);
  return router;
}
