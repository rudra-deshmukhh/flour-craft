import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

// User validation rules
export const validateUserRegistration = [
  body('phoneNumber')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  validateRequest
];

// Address validation rules
export const validateAddress = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Address title is required'),
  body('addressLine')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Address line must be between 10 and 200 characters'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('pincode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Please provide a valid Indian pincode'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  validateRequest
];

// Order validation rules
export const validateOrder = [
  body('addressId')
    .isUUID()
    .withMessage('Valid address ID is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .isUUID()
    .withMessage('Valid product ID is required'),
  body('items.*.quantity')
    .isFloat({ min: 0.5, max: 100 })
    .withMessage('Quantity must be between 0.5 and 100 kg'),
  body('deliverySlot')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid delivery slot'),
  body('paymentMethod')
    .optional()
    .isIn(['UPI', 'CASH', 'CARD'])
    .withMessage('Invalid payment method'),
  validateRequest
];

// Product validation rules
export const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('pricePerKg')
    .isFloat({ min: 0.01 })
    .withMessage('Price per kg must be greater than 0'),
  body('minQuantity')
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage('Minimum quantity must be at least 0.1 kg'),
  body('maxQuantity')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Maximum quantity must be at least 1 kg'),
  validateRequest
];

// Subscription validation rules
export const validateSubscription = [
  body('addressId')
    .isUUID()
    .withMessage('Valid address ID is required'),
  body('frequency')
    .isIn(['WEEKLY', 'BI_WEEKLY', 'MONTHLY'])
    .withMessage('Invalid subscription frequency'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .isUUID()
    .withMessage('Valid product ID is required'),
  body('items.*.quantity')
    .isFloat({ min: 0.5, max: 100 })
    .withMessage('Quantity must be between 0.5 and 100 kg'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  validateRequest
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validateRequest
];

// UUID parameter validation
export const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  validateRequest
];

// Pincode validation
export const validatePincode = [
  param('pincode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Please provide a valid Indian pincode'),
  validateRequest
];

// Rating validation
export const validateRating = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback must not exceed 500 characters'),
  validateRequest
];

// Discount validation
export const validateDiscount = [
  body('code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .isAlphanumeric()
    .withMessage('Discount code must be 3-20 alphanumeric characters'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('type')
    .isIn(['PERCENTAGE', 'FLAT'])
    .withMessage('Type must be either PERCENTAGE or FLAT'),
  body('value')
    .isFloat({ min: 0.01 })
    .withMessage('Value must be greater than 0'),
  body('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be non-negative'),
  body('maxDiscount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum discount must be non-negative'),
  body('validFrom')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  body('validUntil')
    .isISO8601()
    .withMessage('Please provide a valid end date'),
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Usage limit must be a positive integer'),
  validateRequest
];