import { Stock } from 'src/stock/stock.model'; // Import Stock model/interface
import { User } from 'src/user/user.model'; // (สมมติว่าคุณมี User model)

// ใช้ Enum สำหรับ Type เพื่อความแม่นยำ
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}
export interface TransactionFilters {
  symbol?: string;
  type?: string;
}

/**
 * Interface สำหรับข้อมูล Transaction ที่ถูกบันทึกในฐานข้อมูล
 * ตรงกับ Prisma Schema
 */
export interface Transaction {
  transaction_id: string;
  // Fields ที่เป็นส่วนหนึ่งของ Composite Key
  user_id: string;
  stock_symbol: string;
  transaction_date: Date;
  // Fields ข้อมูล
  transaction_type: TransactionType; // ใช้ Enum
  quantity: number;
  price_per_share: number;
  total_amount: number;
  commission: number;
  created_at: Date;

  // Optional: ความสัมพันธ์
  user?: User;
  stock?: Stock;
}

/**
 * Interface สำหรับข้อมูล Input ที่รับจาก Client (DTO)
 * ใช้ใน Controller และ Service
 */
export interface TransactionInput {
  user_id: string;
  stock_symbol: string;
  transaction_date: Date;
  quantity: number;
  price_per_share: number;
  commission: number;
  // ไม่รวม transaction_type, total_amount เพราะ Service จะเป็นผู้กำหนด
}
