import fastify from 'fastify';
import cors from '@fastify/cors';
import verifyRoute from './routes/verify';
import publishRoute from './routes/publish';
import uploadRoute from './routes/upload';

const app = fastify({
  logger: true,
  bodyLimit: 20 * 1024 * 1024
});

const start = async () => {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true
  });

  await app.register(verifyRoute);
  await app.register(publishRoute);
  await app.register(uploadRoute);

  app.get('/health', async () => ({ status: 'ok' }));

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
