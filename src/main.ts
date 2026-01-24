import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://192.168.64.2:8080',
      'http://192.168.64.2:3000',
    ],
    credentials: true,
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
