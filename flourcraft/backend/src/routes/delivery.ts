import { Router } from 'express';
import { authenticate, deliveryPartnerOnly } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Delivery partner routes
router.get('/orders', deliveryPartnerOnly /* getAssignedOrders */);
router.post('/location', deliveryPartnerOnly /* updateLocation */);
router.post('/orders/:id/start', deliveryPartnerOnly /* validateUUID, startDelivery */);
router.post('/orders/:id/complete', deliveryPartnerOnly /* validateUUID, completeDelivery */);
router.get('/batches', deliveryPartnerOnly /* getDeliveryBatches */);
router.post('/batches/:id/start', deliveryPartnerOnly /* validateUUID, startBatch */);
router.post('/batches/:id/complete', deliveryPartnerOnly /* validateUUID, completeBatch */);

export default router;