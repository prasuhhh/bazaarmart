import { Router } from 'express';
import { authenticate, authorizeEmail } from '../middleware/auth.js';
import { deleteAccount, getMe, login, patchMe, patchProfile, register, updateProfile } from '../controllers/userController.js';
import meRoutes from './meRoutes.js';

export function createUserRoutes({ loginLimiter, registerLimiter }) {
  const router = Router();
  router.post('/login', loginLimiter, login);
  router.post('/users', registerLimiter, register);
  router.get('/users/me', authenticate, getMe);
  router.patch('/users/me', authenticate, patchMe);
  router.delete('/users/me', authenticate, deleteAccount);
  router.use('/users/me', authenticate, meRoutes);
  router.put('/users', authenticate, authorizeEmail, updateProfile);
  router.patch('/users', authenticate, authorizeEmail, patchProfile);
  router.delete('/users', authenticate, authorizeEmail, deleteAccount);
  return router;
}
