import { Router } from 'express';
import { getKit, listCredits, listKits, listZones, search } from '../controllers/catalogueController.js';
import { catalogueAccess } from '../middleware/auth.js';

const router = Router();

router.get('/zones', listZones);
router.get('/search', catalogueAccess, search);
router.get('/credits', listCredits);
router.get('/kits', listKits);
router.get('/kits/:id', catalogueAccess, getKit);

export default router;
