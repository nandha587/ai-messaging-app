// src/services/notifications.js
// Stubbed out — notifications are not used in the self-contained mock build.
// expo-notifications has been removed to avoid FCM/google-services.json requirements.

export const registerForPushNotifications = async () => null;
export const sendTokenToServer = async () => {};
export const addNotificationReceivedListener = (handler) => () => {};
export const addNotificationResponseListener = (handler) => () => {};
export const getLastNotificationResponse = async () => null;
export const dismissAllNotifications = async () => {};
export const scheduleLocalNotification = async () => {};

export default {
  registerForPushNotifications,
  sendTokenToServer,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  dismissAllNotifications,
  scheduleLocalNotification,
};
