import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateUserRegistration } from '../middleware/validation';

const router = Router();

// Public routes
router.post('/register', validateUserRegistration, authController.registerOrLogin);
router.post('/login', authController.registerOrLogin);

// Protected routes
router.use(authenticate);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.delete('/account', authController.deleteAccount);
router.get('/verify', authController.verifyToken);
router.get('/stats', authController.getUserStats);

export default router;