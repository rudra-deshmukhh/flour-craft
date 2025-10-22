import { Router } from 'express';
import { authenticate, customerOnly, flourMillOnly } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.get('/', customerOnly /* getMyOrders */);
router.post('/', customerOnly /* validateOrder, createOrder */);
router.get('/:id', customerOnly /* validateUUID, getOrderById */);
router.post('/:id/cancel', customerOnly /* validateUUID, cancelOrder */);
router.get('/:id/track', customerOnly /* validateUUID, trackOrder */);
router.post('/:id/rate', customerOnly /* validateUUID, validateRating, rateOrder */);

// Flour mill routes
router.post('/:id/start-grinding', flourMillOnly /* validateUUID, startGrinding */);
router.post('/:id/complete-grinding', flourMillOnly /* validateUUID, completeGrinding */);

export default router;