// import { Module } from '@nestjs/common';
// import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { JwtStrategy } from './jwt.strategy';
// import { UserModule } from 'src/user/user.module';

// @Module({
//   imports: [
//     UserModule,
//     PassportModule,
//     JwtModule.register({
//       secret: 'secretKey',
//       signOptions: { expiresIn: '1h' },
//     }),
//   ],
//   controllers: [AuthController],
//   providers: [AuthService, JwtStrategy],
// })
// export class AuthModule {}
