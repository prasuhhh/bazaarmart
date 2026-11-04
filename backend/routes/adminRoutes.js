import { Router } from 'express';
import { updateOrderStatus } from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);
router.patch('/orders/:orderNo/status', updateOrderStatus);

export default router;
