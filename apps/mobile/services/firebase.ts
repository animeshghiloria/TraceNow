/**
 * Firebase initialization for TraceNow mobile app.
 * DISABLED: Using mock authentication instead
 */

// Mock Firebase objects to prevent errors
export const firebaseApp = {
  name: 'mock-app',
  options: {}
};

export const auth = {
  currentUser: null,
  signInWithPhoneNumber: () => Promise.reject(new Error('Firebase disabled in mock mode')),
  signInWithCredential: () => Promise.reject(new Error('Firebase disabled in mock mode')),
};
