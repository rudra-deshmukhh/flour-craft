import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Address routes would go here
// router.get('/addresses', getAddresses);
// router.post('/addresses', validateAddress, createAddress);
// router.put('/addresses/:id', validateUUID, validateAddress, updateAddress);
// router.delete('/addresses/:id', validateUUID, deleteAddress);

// Notification routes
// router.get('/notifications', getNotifications);
// router.put('/notifications/:id/read', markNotificationRead);

export default router;