//ตัวกลางจัดการ HTTP ไปยัง Python
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class QuantClientService {
  private readonly logger = new Logger(QuantClientService.name);
  private readonly baseUrl = process.env.QUANT_API_BASE_URL;

  constructor(private readonly httpService: HttpService) {}

  // helper function POST or GET to other api
  // async get<T>(endpoint: string, data?: any): Promise<T> {
  //   try {
  //     const { data: response } = await firstValueFrom(
  //       this.httpService.get<T>(`${this.baseUrl}${endpoint}`, data),
  //     );
  //     return response;
  //   } catch (error) {
  //     const errorMessage =
  //       error instanceof Error ? error.message : String(error);
  //     this.logger.error(
  //       `Error calling Python GET API (${endpoint}): ${errorMessage}`,
  //     );
  //     throw error;
  //   }
  // }

  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    // eslint-disable-next-line no-useless-catch
    try {
      const { data: response } = await firstValueFrom(
        this.httpService.get<T>(`${this.baseUrl}${endpoint}`, config), // เปลี่ยนเป็น config
      );
      return response;
    } catch (error) {
      // เก็บก้อน error ของ Axios ไว้เพื่อให้ชั้นนอกอ่าน response status ได้
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error calling Python API (${endpoint}): ${errorMessage}`,
      );
      throw error;
    }
  }
}
