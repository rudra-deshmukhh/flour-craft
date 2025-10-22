import admin from 'firebase-admin';

let firebaseApp: admin.app.App;

export const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
      
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

export const getAuth = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.auth();
};

export const getFirestore = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.firestore();
};

export const getStorage = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.storage();
};

export const getMessaging = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.messaging();
};

// Verify Firebase ID token
export const verifyIdToken = async (idToken: string) => {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid token');
  }
};

// Send notification via FCM
export const sendNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  try {
    const messaging = getMessaging();
    
    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log('✅ Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
    throw error;
  }
};

export default { initializeFirebase, getAuth, getFirestore, getStorage, getMessaging };