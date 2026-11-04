import { Router } from 'express';
import { getOrder, listMyOrders, placeOrder, trackOrder, updateOrder } from '../controllers/orderController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', optionalAuth, placeOrder);
router.get('/', authenticate, listMyOrders);
router.get('/:orderNo', optionalAuth, getOrder);
router.get('/:orderNo/track', optionalAuth, trackOrder);
router.patch('/:orderNo', optionalAuth, updateOrder);

export default router;
