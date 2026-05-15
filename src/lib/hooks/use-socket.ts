'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface HotspotNotification {
  title: string;
  summary: string;
  score: number;
  sourceType: string;
  sourceUrl?: string;
  receivedAt: string;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<HotspotNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const s = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('new-hotspot', (data: Omit<HotspotNotification, 'receivedAt'>) => {
      const notification: HotspotNotification = {
        ...data,
        receivedAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((n) => n + 1);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`⚡ 热点 [${data.score}分]`, {
          body: `${data.title}\n${data.summary}`,
        });
      }
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { socket, connected, notifications, unreadCount, clearUnread, clearNotifications };
}
