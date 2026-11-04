import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  createProduct, deleteProduct, listByCategory, listProducts, updateProduct
} from '../controllers/productController.js';

const router = Router();

router.use(authenticate);
router.get('/', listProducts);
router.get('/:category', listByCategory);
router.post('/', requireAdmin, createProduct);
router.put('/', requireAdmin, updateProduct);
router.delete('/', requireAdmin, deleteProduct);

export default router;
