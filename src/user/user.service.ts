import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { User, UserTaxInfoDto} from './user.model';
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

    async updateUser(username: string, data: User): Promise<User> {
        return this.prisma.user.update({ where: { username: String(username) }, data });
    }

    async getUserTaxInfo(userId: string, taxYear: number) {
      try {
        const res = await this.prisma.userTaxInfo.findUnique({
          where: {
            user_id_tax_year: {
              user_id: userId,
              tax_year: taxYear,
            },
          },
        });
        return res
      } catch (error) {
        console.log("test")
        throw error; 
      }
    }

    async updateUserTaxInfo(userId: string, data: UserTaxInfoDto) {
      const taxYear  = data.tax_year;
      try {
        const existing = await this.prisma.userTaxInfo.findUnique({
          where: {
            user_id_tax_year: {
              user_id: userId,
              tax_year: taxYear,
            },
          },
        });

        if (existing) {
          //Update
          return await this.prisma.userTaxInfo.update({
            where: {
              user_id_tax_year: {
                user_id: userId,
                tax_year: taxYear,
              },
            },
            data,
          });
        } else {
          //Create
          return await this.prisma.userTaxInfo.create({
            data: {
              ...data,
              user: {
                connect: { user_id: userId },
              },
            },
          });
        }
      } catch (error) {
        throw error; 
      }
  }
  async createInitTaxInfo(userId: string, year: number) {
    return this.prisma.userTaxInfo.create({
      data: {
        tax_year: year,
        annual_income: 0,
        tax_bracket: 0,
        personal_deduction: 0,
        spouse_deduction: 0,
        child_deduction: 0,
        parent_deduction: 0,
        life_insurance_deduction: 0,
        health_insurance_deduction: 0,
        provident_fund_deduction: 0,
        retirement_mutual_fund: 0,
        user: {
          connect: { user_id: userId },
        },
      },
    });
  }

}
