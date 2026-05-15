import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('[socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[socket] Client disconnected:', socket.id);
    });
  });

  // 将 io 实例存到全局，供 API routes 使用
  (global as Record<string, unknown>).__socketIO = io;

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on path /api/socketio`);
  });
});
