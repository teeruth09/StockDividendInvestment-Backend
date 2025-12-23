import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { User, UserTaxInfoDto } from './user.model';

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
    return this.prisma.user.update({
      where: { username: String(username) },
      data,
    });
  }

  async getUserTaxInfo(userId: string, taxYear: number) {
    // eslint-disable-next-line no-useless-catch
    try {
      const res = await this.prisma.userTaxInfo.findUnique({
        where: {
          user_id_tax_year: {
            user_id: userId,
            tax_year: taxYear,
          },
        },
      });
      return res;
    } catch (error) {
      throw error;
    }
  }

  async updateUserTaxInfo(userId: string, data: UserTaxInfoDto) {
    const taxYear = data.tax_year;
    // eslint-disable-next-line no-useless-catch
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
        salary: 0,
        bonus: 0,
        other_income: 0,
        personal_deduction: 60000,
        spouse_deduction: 0,
        child_deduction: 0,
        parent_deduction: 0,
        disabled_deduction: 0,
        social_security: 0,
        life_insurance: 0,
        health_insurance: 0,
        parent_health_insurance: 0,
        pvd_deduction: 0,
        ssf_investment: 0,
        rmf_investment: 0,
        thaiesg_investment: 0,
        home_loan_interest: 0,
        donation_general: 0,
        donation_education: 0,
        user: {
          connect: { user_id: userId },
        },
      },
    });
  }
}
