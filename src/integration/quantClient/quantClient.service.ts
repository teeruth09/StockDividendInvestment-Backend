//ตัวกลางจัดการ HTTP ไปยัง Python
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class QuantClientService {
  private readonly logger = new Logger(QuantClientService.name);
  private readonly baseUrl = process.env.QUANT_API_BASE_URL;

  constructor(private readonly httpService: HttpService) {}

  // helper function POST or GET to other api
  async get<T>(endpoint: string): Promise<T> {
    try {
      const { data: response } = await firstValueFrom(
        this.httpService.get<T>(`${this.baseUrl}${endpoint}`),
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error calling Python GET API (${endpoint}): ${error.message}`,
      );
      throw error;
    }
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const { data: response } = await firstValueFrom(
        this.httpService.post<T>(`${this.baseUrl}${endpoint}`, data),
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error calling Python API (${endpoint}): ${error.message}`,
      );
      throw error;
    }
  }
}
