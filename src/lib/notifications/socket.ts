import { Server as SocketIOServer } from 'socket.io';

export function getIO(): SocketIOServer | null {
  return (global as Record<string, unknown>).__socketIO as SocketIOServer | null;
}

export function emitHotspot(data: {
  title: string;
  summary: string;
  score: number;
  sourceType: string;
  sourceUrl?: string;
}) {
  const io = getIO();
  if (!io) {
    console.warn('[socket] IO not initialized, cannot emit');
    return;
  }
  io.emit('new-hotspot', data);
}
