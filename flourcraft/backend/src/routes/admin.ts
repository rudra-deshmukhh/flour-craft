import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// User management
router.get('/users' /* validatePagination, getAllUsers */);
router.get('/users/:id' /* validateUUID, getUserById */);
router.put('/users/:id' /* validateUUID, updateUserRole */);

// Order management
router.get('/orders' /* validatePagination, getAllOrders */);
router.get('/orders/:id' /* validateUUID, getOrderById */);
router.put('/orders/:id/assign-delivery' /* validateUUID, assignDeliveryPartner */);

// Product management
router.get('/products' /* validatePagination, getAllProducts */);
router.post('/products' /* validateProduct, createProduct */);
router.put('/products/:id' /* validateUUID, validateProduct, updateProduct */);

// Analytics
router.get('/analytics/orders' /* getOrderAnalytics */);
router.get('/analytics/sales' /* getSalesAnalytics */);
router.get('/analytics/users' /* getUserAnalytics */);

// Discount management
router.get('/discounts' /* validatePagination, getDiscounts */);
router.post('/discounts' /* validateDiscount, createDiscount */);
router.put('/discounts/:id' /* validateUUID, validateDiscount, updateDiscount */);

// Flour mill management
router.get('/flour-mills' /* validatePagination, getFlourMills */);
router.post('/flour-mills' /* createFlourMill */);
router.put('/flour-mills/:id' /* validateUUID, updateFlourMill */);

// Delivery partner management
router.get('/delivery-partners' /* validatePagination, getDeliveryPartners */);
router.post('/delivery-partners' /* createDeliveryPartner */);
router.put('/delivery-partners/:id' /* validateUUID, updateDeliveryPartner */);

// Pincode serviceability
router.get('/pincodes' /* validatePagination, getPincodes */);
router.post('/pincodes' /* validatePincode, addPincode */);
router.delete('/pincodes/:pincode' /* validatePincode, removePincode */);

export default router;