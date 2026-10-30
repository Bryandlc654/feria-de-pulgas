import http from 'http';
import next from 'next';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './src/server/socketHandler';
import { initDatabase } from './src/server/db';
import { ClientToServerEvents, ServerToClientEvents } from './src/types/game';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

async function bootstrap() {
  try {
    await nextApp.prepare();

    // Initialize MySQL Database
    await initDatabase();

    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 10000,
      pingInterval: 5000,
    });

    setupSocketHandlers(io);

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ El puerto ${port} ya está en uso. Intenta cerrarlo o cambiar PORT en .env.`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
      }
    });

    server.listen(port, () => {
      console.log(`> 🏺 Feria de Pulgas server ready on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
