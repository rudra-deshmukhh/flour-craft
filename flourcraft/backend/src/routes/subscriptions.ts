import { Router } from 'express';
import { authenticate, customerOnly, adminOnly } from '../middleware/auth';
import { validateSubscription, validateUUID, validatePagination } from '../middleware/validation';
import * as subscriptionController from '../controllers/subscriptionController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer subscription routes
router.get('/', customerOnly, subscriptionController.getMySubscriptions);
router.post('/', customerOnly, validateSubscription, subscriptionController.createSubscription);
router.get('/upcoming', customerOnly, subscriptionController.getUpcomingDeliveries);
router.get('/:id', customerOnly, validateUUID, subscriptionController.getSubscriptionById);
router.put('/:id', customerOnly, validateUUID, validateSubscription, subscriptionController.updateSubscription);
router.post('/:id/pause', customerOnly, validateUUID, subscriptionController.pauseSubscription);
router.post('/:id/resume', customerOnly, validateUUID, subscriptionController.resumeSubscription);
router.delete('/:id', customerOnly, validateUUID, subscriptionController.cancelSubscription);

// Admin routes
router.get('/admin/all', adminOnly, validatePagination, subscriptionController.getAllSubscriptions);

export default router;