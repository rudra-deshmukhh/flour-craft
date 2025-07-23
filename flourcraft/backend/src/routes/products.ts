import { Router } from 'express';
import { optionalAuth, adminOnly } from '../middleware/auth';
import { validatePagination } from '../middleware/validation';

const router = Router();

// Public routes with optional authentication
router.get('/', optionalAuth, validatePagination /* getProducts */);
router.get('/categories', /* getCategories */);
router.get('/:id', optionalAuth, /* getProductById */);

// Admin only routes
router.use(adminOnly);
router.post('/', /* validateProduct, createProduct */);
router.put('/:id', /* validateUUID, validateProduct, updateProduct */);
router.delete('/:id', /* validateUUID, deleteProduct */);

export default router;