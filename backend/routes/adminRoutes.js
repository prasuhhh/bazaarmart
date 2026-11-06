import { Router } from 'express';
import { answerQuestion, listOpenQuestions, listOrders, updateOrderStatus } from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);
router.get('/orders', listOrders);
router.patch('/orders/:orderNo/status', updateOrderStatus);
router.get('/questions', listOpenQuestions);
router.patch('/questions/:id', answerQuestion);

export default router;
