export interface UPIPaymentData {
  recipientUPI: string;
  recipientName: string;
  amount: number;
  transactionNote: string;
  transactionRef: string;
}

export const generateUPIDeepLink = (paymentData: UPIPaymentData): string => {
  const { recipientUPI, recipientName, amount, transactionNote, transactionRef } = paymentData;
  
  // UPI URL format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tn=NOTE&tr=REF
  const upiParams = new URLSearchParams({
    pa: recipientUPI,
    pn: recipientName,
    am: amount.toString(),
    tn: transactionNote,
    tr: transactionRef,
    cu: 'INR'
  });

  return `upi://pay?${upiParams.toString()}`;
};

export const generateUPILinks = (paymentData: UPIPaymentData) => {
  const baseUPILink = generateUPIDeepLink(paymentData);
  
  return {
    generic: baseUPILink,
    gpay: `tez://upi/pay?${new URLSearchParams({
      pa: paymentData.recipientUPI,
      pn: paymentData.recipientName,
      am: paymentData.amount.toString(),
      tn: paymentData.transactionNote,
      tr: paymentData.transactionRef
    }).toString()}`,
    phonepe: `phonepe://pay?${new URLSearchParams({
      pa: paymentData.recipientUPI,
      pn: paymentData.recipientName,
      am: paymentData.amount.toString(),
      tn: paymentData.transactionNote,
      tr: paymentData.transactionRef
    }).toString()}`,
    paytm: `paytmmp://pay?${new URLSearchParams({
      pa: paymentData.recipientUPI,
      pn: paymentData.recipientName,
      am: paymentData.amount.toString(),
      tn: paymentData.transactionNote,
      tr: paymentData.transactionRef
    }).toString()}`
  };
};

export const validateTransactionReference = (transactionRef: string): boolean => {
  // Transaction reference should be alphanumeric and 8-35 characters
  const regex = /^[a-zA-Z0-9]{8,35}$/;
  return regex.test(transactionRef);
};

export const generateTransactionReference = (orderNumber: string): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `FC${orderNumber.slice(-4)}${timestamp}${random}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const validateUPIId = (upiId: string): boolean => {
  // UPI ID format: username@provider
  const regex = /^[a-zA-Z0-9.-]{2,256}@[a-zA-Z]{2,64}$/;
  return regex.test(upiId);
};