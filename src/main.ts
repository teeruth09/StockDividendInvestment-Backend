import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://192.168.64.2:8080',
      'http://192.168.64.2:3000',
    ],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port:${port} in [${nodeEnv}] mode`);
}
bootstrap();
