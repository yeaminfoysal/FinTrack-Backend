import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Modification #1: monetary values are BigInt paisa. Serialize BigInt as a JS number in JSON
// responses (finance values stay well within Number.MAX_SAFE_INTEGER).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
): number {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`FinTrack backend running on http://localhost:${port}/api`);
}

void bootstrap();
