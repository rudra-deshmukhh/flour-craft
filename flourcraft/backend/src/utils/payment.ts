import { v4 as uuidv4 } from 'uuid';

export interface UPIPaymentData {
  recipientUPI: string;
  recipientName: string;
  amount: number;
  transactionNote: string;
  transactionRef: string;
}

export interface PaymentLinks {
  generic: string;
  gpay: string;
  phonepe: string;
  paytm: string;
  bhim: string;
}

// Generate UPI payment links for different apps
export function generateUPILinks(paymentData: UPIPaymentData): PaymentLinks {
  const { recipientUPI, recipientName, amount, transactionNote, transactionRef } = paymentData;
  
  // Base UPI URL parameters
  const baseParams = new URLSearchParams({
    pa: recipientUPI, // Payee Address (UPI ID)
    pn: recipientName, // Payee Name
    am: amount.toString(), // Amount
    tn: transactionNote, // Transaction Note
    tr: transactionRef, // Transaction Reference
    cu: 'INR' // Currency
  });

  // Generic UPI URL (works with most UPI apps)
  const genericURL = `upi://pay?${baseParams.toString()}`;

  // GPay specific URL
  const gpayURL = `gpay://upi/pay?${baseParams.toString()}`;

  // PhonePe specific URL
  const phonepeURL = `phonepe://pay?${baseParams.toString()}`;

  // Paytm specific URL
  const paytmURL = `paytmmp://pay?${baseParams.toString()}`;

  // BHIM specific URL
  const bhimURL = `bhim://pay?${baseParams.toString()}`;

  return {
    generic: genericURL,
    gpay: gpayURL,
    phonepe: phonepeURL,
    paytm: paytmURL,
    bhim: bhimURL
  };
}

// Generate unique transaction reference
export function generateTransactionReference(orderNumber: string): string {
  const timestamp = Date.now().toString();
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FC${orderNumber}_${timestamp}_${randomString}`;
}

// Generate UPI QR code data
export function generateUPIQRData(paymentData: UPIPaymentData): string {
  const { recipientUPI, recipientName, amount, transactionNote, transactionRef } = paymentData;
  
  // UPI QR code format
  const qrData = `upi://pay?pa=${encodeURIComponent(recipientUPI)}&pn=${encodeURIComponent(recipientName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&tr=${encodeURIComponent(transactionRef)}&cu=INR`;
  
  return qrData;
}

// Validate UPI ID format
export function validateUPIID(upiId: string): boolean {
  // Basic UPI ID validation pattern
  const upiPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
  return upiPattern.test(upiId);
}

// Format amount for UPI (remove decimal if whole number)
export function formatUPIAmount(amount: number): string {
  return amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
}

// Generate payment intent for web browsers
export function generateWebPaymentIntent(paymentData: UPIPaymentData): {
  intentURL: string;
  fallbackURL: string;
} {
  const upiURL = generateUPILinks(paymentData).generic;
  
  // For web browsers, we need to handle the UPI intent differently
  const intentURL = `intent://pay?${new URLSearchParams({
    pa: paymentData.recipientUPI,
    pn: paymentData.recipientName,
    am: paymentData.amount.toString(),
    tn: paymentData.transactionNote,
    tr: paymentData.transactionRef,
    cu: 'INR'
  }).toString()}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;

  // Fallback URL for desktop/unsupported browsers
  const fallbackURL = `https://pay.google.com/gp/w/u/0/home/signup?utm_source=pp_inline&utm_medium=pp&utm_campaign=pp_inline`;

  return {
    intentURL,
    fallbackURL
  };
}

// Generate payment links with app detection
export function generateSmartPaymentLinks(paymentData: UPIPaymentData, userAgent?: string): PaymentLinks & {
  recommended: string;
  webIntent: string;
} {
  const links = generateUPILinks(paymentData);
  const webIntent = generateWebPaymentIntent(paymentData);
  
  // Detect preferred app based on user agent or other factors
  let recommended = links.generic;
  
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('phonepe')) {
      recommended = links.phonepe;
    } else if (ua.includes('paytm')) {
      recommended = links.paytm;
    } else if (ua.includes('googlepay') || ua.includes('gpay')) {
      recommended = links.gpay;
    }
  }

  return {
    ...links,
    recommended,
    webIntent: webIntent.intentURL
  };
}

// Payment verification helpers
export function generatePaymentVerificationToken(): string {
  return uuidv4();
}

export function validateTransactionId(transactionId: string): boolean {
  // Basic transaction ID validation
  // UPI transaction IDs are typically 12 digits
  const transactionPattern = /^[0-9]{12}$/;
  return transactionPattern.test(transactionId);
}

// Calculate payment processing fee (if applicable)
export function calculatePaymentFee(amount: number, paymentMethod: string): number {
  // For UPI, typically no processing fee for customers
  // But you might have different rates for different methods
  switch (paymentMethod.toLowerCase()) {
    case 'upi':
    case 'gpay':
    case 'phonepe':
    case 'paytm':
      return 0; // No fee for UPI payments
    case 'card':
      return Math.round(amount * 0.02); // 2% for card payments
    case 'netbanking':
      return Math.round(amount * 0.015); // 1.5% for net banking
    default:
      return 0;
  }
}

// Generate payment summary for orders
export function generatePaymentSummary(order: {
  totalAmount: number;
  deliveryCharge: number;
  discount: number;
  finalAmount: number;
}) {
  return {
    subtotal: order.totalAmount,
    deliveryCharge: order.deliveryCharge,
    discount: order.discount,
    processingFee: 0, // No processing fee for UPI
    total: order.finalAmount,
    savings: order.discount + (order.deliveryCharge === 0 ? 30 : 0)
  };
}

// Create payment link with expiry
export function createPaymentLinkWithExpiry(
  paymentData: UPIPaymentData, 
  expiryMinutes: number = 30
): {
  links: PaymentLinks;
  expiresAt: Date;
  isExpired: () => boolean;
} {
  const links = generateUPILinks(paymentData);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  return {
    links,
    expiresAt,
    isExpired: () => new Date() > expiresAt
  };
}

// Payment status tracking
export interface PaymentStatus {
  orderId: string;
  transactionId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  amount: number;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
}

// Mock payment verification (replace with actual payment gateway integration)
export async function verifyPayment(
  transactionId: string, 
  expectedAmount: number,
  orderRef: string
): Promise<{
  isValid: boolean;
  amount?: number;
  status?: string;
  message?: string;
}> {
  // In a real implementation, you would:
  // 1. Call the payment gateway API to verify the transaction
  // 2. Check if the transaction amount matches the expected amount
  // 3. Verify the transaction status
  // 4. Return the verification result

  // Mock implementation for demonstration
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock validation logic
    if (!validateTransactionId(transactionId)) {
      return {
        isValid: false,
        message: 'Invalid transaction ID format'
      };
    }

    // Simulate successful verification
    return {
      isValid: true,
      amount: expectedAmount,
      status: 'SUCCESS',
      message: 'Payment verified successfully'
    };
  } catch (error) {
    return {
      isValid: false,
      message: 'Payment verification failed'
    };
  }
}

// Generate payment receipt data
export function generatePaymentReceipt(order: any, payment: any) {
  return {
    receiptNumber: `RCP${Date.now()}`,
    orderNumber: order.orderNumber,
    transactionId: payment.transactionId,
    paymentMethod: payment.paymentMethod,
    amount: order.finalAmount,
    paidAt: new Date(),
    customer: {
      name: `${order.user.firstName} ${order.user.lastName}`,
      phone: order.user.phoneNumber,
      email: order.user.email
    },
    items: order.orderItems.map((item: any) => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.pricePerKg,
      total: item.totalPrice
    })),
    breakdown: generatePaymentSummary(order)
  };
}

// Payment retry logic
export function shouldRetryPayment(attempt: number, maxAttempts: number = 3): boolean {
  return attempt < maxAttempts;
}

export function getRetryDelay(attempt: number): number {
  // Exponential backoff: 2^attempt seconds
  return Math.pow(2, attempt) * 1000;
}

// Payment analytics helpers
export function getPaymentMethodFromUPI(upiId: string): string {
  const domain = upiId.split('@')[1]?.toLowerCase();
  
  const methodMap: { [key: string]: string } = {
    'paytm': 'Paytm',
    'googlepay': 'Google Pay',
    'phonepe': 'PhonePe',
    'bhim': 'BHIM',
    'ybl': 'PhonePe',
    'okaxis': 'Axis Bank',
    'okhdfcbank': 'HDFC Bank',
    'oksbi': 'SBI',
    'okicici': 'ICICI Bank'
  };

  return methodMap[domain] || 'UPI';
}

// Currency formatting for Indian Rupees
export function formatINRCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// Payment link sharing helpers
export function generatePaymentMessage(order: any, paymentLinks: PaymentLinks): string {
  return `
🛒 FlourCraft Order Payment

Order: ${order.orderNumber}
Amount: ${formatINRCurrency(order.finalAmount)}

Pay using any UPI app:
📱 Google Pay: ${paymentLinks.gpay}
📱 PhonePe: ${paymentLinks.phonepe}
📱 Paytm: ${paymentLinks.paytm}
📱 Any UPI App: ${paymentLinks.generic}

Thank you for choosing FlourCraft! 🌾
  `.trim();
}

export function generateWhatsAppPaymentLink(
  phoneNumber: string, 
  order: any, 
  paymentLinks: PaymentLinks
): string {
  const message = encodeURIComponent(generatePaymentMessage(order, paymentLinks));
  return `https://wa.me/${phoneNumber}?text=${message}`;
}

export default {
  generateUPILinks,
  generateTransactionReference,
  generateUPIQRData,
  validateUPIID,
  formatUPIAmount,
  generateWebPaymentIntent,
  generateSmartPaymentLinks,
  generatePaymentVerificationToken,
  validateTransactionId,
  calculatePaymentFee,
  generatePaymentSummary,
  createPaymentLinkWithExpiry,
  verifyPayment,
  generatePaymentReceipt,
  shouldRetryPayment,
  getRetryDelay,
  getPaymentMethodFromUPI,
  formatINRCurrency,
  generatePaymentMessage,
  generateWhatsAppPaymentLink
};