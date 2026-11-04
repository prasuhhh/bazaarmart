import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { listMyOrders, placeOrder } from '../controllers/orderController.js';

const router = Router();

router.use(authenticate);
router.post('/', placeOrder);
router.get('/', listMyOrders);

export default router;
