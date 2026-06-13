import { Notification } from '../models/Notification.js';

/**
 * Helper to create an in-app notification.
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @param {Object} data - { title, message, type, priority }
 */
export const createNotification = async (userId, data) => {
  try {
    const notification = await Notification.create({
      userId,
      title: data.title,
      message: data.message,
      type: data.type || 'system',
      priority: data.priority || 'low'
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};
