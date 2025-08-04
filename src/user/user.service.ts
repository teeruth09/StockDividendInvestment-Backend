import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { User,CreateUserDto } from './user.model';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) {}

    async getAllUsers(): Promise<User[]> {
        return this.prisma.user.findMany();
    }

    async getUser(username: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { username } });
    }

    async createUser(data: CreateUserDto) {
    console.log('createUser:', data); // เช็คว่ามีค่าอะไรส่งเข้ามา
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
      },
    });
}

    async updateUser(username: string, data: User): Promise<User> {
        return this.prisma.user.update({ where: { id: String(username) }, data });
      }

}
