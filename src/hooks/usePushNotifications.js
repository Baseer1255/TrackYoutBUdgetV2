import { useEffect, useCallback } from 'react';

/**
 * usePushNotifications
 * Requests browser Notification permission on mount and exposes a `notify()` helper.
 * Falls back silently if permissions are denied or the Notification API is unavailable.
 */
export function usePushNotifications() {
  useEffect(() => {
    // Request permission non-blockingly — don't disrupt the UI
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        // Silently ignore if user blocks or browser doesn't support it
      });
    }
  }, []);

  const notify = useCallback((title, body, options = {}) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        body,
        icon: '/icons.svg',
        badge: '/icons.svg',
        ...options,
      });
    } catch (err) {
      console.warn('Notification failed:', err);
    }
  }, []);

  return { notify };
}
