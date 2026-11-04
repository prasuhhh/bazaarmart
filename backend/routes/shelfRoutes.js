import { Router } from 'express';
import {
  addShelfItem, createShelf, deleteShelf, getSharedShelf, getShelf, listShelves, removeShelfItem, renameShelf
} from '../controllers/shelfController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public, and must stay ahead of the login check below.
router.get('/shared/:shareId', getSharedShelf);

router.use(authenticate);
router.route('/').get(listShelves).post(createShelf);
router.route('/:id').get(getShelf).patch(renameShelf).delete(deleteShelf);
router.post('/:id/items', addShelfItem);
router.delete('/:id/items/:productId', removeShelfItem);

export default router;
