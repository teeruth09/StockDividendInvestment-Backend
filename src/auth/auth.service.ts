import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, LoginUserDto } from './auth.model';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';

interface ValidatedUser {
  user_id: string;
  username: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateUser(username: string, password: string): Promise<ValidatedUser | null> {
    const user = await this.userService.getUser(username);
    if (user && (await bcrypt.compare(password, user.password))) {
      // const { password, ...result } = user;
      // return result;
      return {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
      };
    }
    return null;
  }

  async login(user: LoginUserDto): Promise<{ access_token: string }> {
    const res = await this.validateUser(user.username, user.password);
    if (!res) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      sub: res.user_id,
      username: user.username,
      email: res.email,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: hashedPassword,
        },
      });
      // สร้าง tax info ของปีล่าสุด (auto)
      await this.userService.createInitTaxInfo(
        user.user_id,
        new Date().getFullYear(),
      );
      const payload = { sub: user.user_id, username: user.username };
      const token = await this.jwtService.signAsync(payload);
      return { access_token: token };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // ตรวจสอบว่าเกิดจาก email หรือ username
        const target = error.meta?.target?.[0];
        throw new ConflictException(`${target} already exists`);
      }
      throw error;
    }
  }
}
