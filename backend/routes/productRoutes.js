import { Router } from 'express';
import {
  addQuestion, addReview, listQuestions, listReviews
} from '../controllers/feedbackController.js';
import {
  createProduct, deleteProduct, getProductSheet, listByCategory, listProducts, updateProduct
} from '../controllers/productController.js';
import { authenticate, catalogueAccess, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', catalogueAccess, listProducts);
router.post('/', authenticate, requireAdmin, createProduct);
router.put('/', authenticate, requireAdmin, updateProduct);
router.delete('/', authenticate, requireAdmin, deleteProduct);

// Must stay ahead of /:category, or "sheet" would be read as a category.
router.get('/sheet/:productId', catalogueAccess, getProductSheet);
router.route('/:productId/reviews').get(listReviews).post(authenticate, addReview);
router.route('/:productId/questions').get(listQuestions).post(authenticate, addQuestion);
router.get('/:category', catalogueAccess, listByCategory);

export default router;
