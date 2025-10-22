import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import {
  getDashboard,
  getAssignedOrders,
  startGrinding,
  completeGrinding,
  getInventory,
  updateStock,
  getStockAlerts,
  resolveAlert,
  initializeInventory
} from '../controllers/flourMillController';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require flour mill user authentication
router.use(requireAuth);
router.use(requireRole([UserRole.FLOUR_MILL_USER]));

// Dashboard routes
router.get('/dashboard', getDashboard);

// Order management routes
router.get('/orders', 
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['PENDING', 'CONFIRMED', 'GRINDING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
  ],
  validateRequest,
  getAssignedOrders
);

router.post('/orders/:orderId/start-grinding',
  [
    param('orderId').isString().notEmpty()
  ],
  validateRequest,
  startGrinding
);

router.post('/orders/:orderId/complete-grinding',
  [
    param('orderId').isString().notEmpty(),
    body('dispatchDelay').optional().isInt({ min: 1, max: 1440 }) // max 24 hours
  ],
  validateRequest,
  completeGrinding
);

// Inventory management routes
router.get('/inventory', getInventory);

router.post('/inventory/initialize', initializeInventory);

router.put('/inventory/:productId',
  [
    param('productId').isString().notEmpty(),
    body('quantity').isFloat({ min: 0 }),
    body('operation').isIn(['add', 'set']),
    body('batchNumber').optional().isString(),
    body('expiryDate').optional().isISO8601(),
    body('unitCost').optional().isFloat({ min: 0 })
  ],
  validateRequest,
  updateStock
);

// Stock alerts routes
router.get('/alerts',
  [
    query('resolved').optional().isBoolean()
  ],
  validateRequest,
  getStockAlerts
);

router.post('/alerts/:alertId/resolve',
  [
    param('alertId').isString().notEmpty(),
    body('notes').optional().isString().isLength({ max: 500 })
  ],
  validateRequest,
  resolveAlert
);

export default router;