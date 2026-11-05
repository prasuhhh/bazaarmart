import { Router } from 'express';
import {
  addShelfItem, createShelf, deleteShelf, getSharedShelf, getSharedShelfCheckout, getShelf, getShelfCheckout,
  listShelves, removeShelfItem, renameShelf
} from '../controllers/shelfController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public, and must stay ahead of the login check below.
router.get('/shared/:shareId', getSharedShelf);
router.get('/shared/:shareId/checkout', getSharedShelfCheckout);

router.use(authenticate);
router.route('/').get(listShelves).post(createShelf);
router.route('/:id').get(getShelf).patch(renameShelf).delete(deleteShelf);
router.get('/:id/checkout', getShelfCheckout);
router.post('/:id/items', addShelfItem);
router.delete('/:id/items/:productId', removeShelfItem);

export default router;
