/**
 * Utility functions for sound notifications
 */
import { soundManager } from './soundManager';

/**
 * Play a notification sound using the sound manager
 * Creates a pleasant "ding" sound with harmonics
 */
export const playNotificationSound = () => {
  soundManager.playNotificationSound();
};

/**
 * Play a specific sound for mention notifications
 * Creates a distinctive "chime" sound to indicate user was mentioned
 */
export const playMentionSound = () => {
  soundManager.playMentionSound();
};

/**
 * Play a sound when the user sends a message
 * Creates a subtle "click" sound
 */
export const playMessageSentSound = () => {
  soundManager.playMessageSentSound();
};

/**
 * Play a sound for incoming messages (not sent by the current user)
 * Creates a gentle "ping" sound for general notifications
 */
export const playMessageReceivedSound = () => {
  soundManager.playMessageReceivedSound();
};

/**
 * Play a test sound for verification
 */
export const playTestSound = () => {
  playNotificationSound();
};