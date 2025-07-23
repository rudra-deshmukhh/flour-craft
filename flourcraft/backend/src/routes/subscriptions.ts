import { Router } from 'express';
import { authenticate, customerOnly } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer subscription routes
router.get('/', customerOnly /* getMySubscriptions */);
router.post('/', customerOnly /* validateSubscription, createSubscription */);
router.get('/:id', customerOnly /* validateUUID, getSubscriptionById */);
router.put('/:id', customerOnly /* validateUUID, validateSubscription, updateSubscription */);
router.post('/:id/pause', customerOnly /* validateUUID, pauseSubscription */);
router.post('/:id/resume', customerOnly /* validateUUID, resumeSubscription */);
router.delete('/:id', customerOnly /* validateUUID, cancelSubscription */);

export default router;