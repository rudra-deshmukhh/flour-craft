import { Router } from 'express';
import { validatePincode } from '../middleware/validation';

const router = Router();

// Public routes
router.get('/pincode/:pincode/serviceability', validatePincode /* checkPincodeServiceability */);
router.get('/app-config' /* getAppConfig */);

export default router;