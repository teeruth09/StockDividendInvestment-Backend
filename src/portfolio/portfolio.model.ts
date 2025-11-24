import { User } from 'src/user/user.model';
import { Stock } from 'src/stock/stock.model';

export class Portfolio {
  user_id: string;
  stock_symbol: string;
  current_quantity: number;
  total_invested: number;
  average_cost: number;
  last_transaction_date: Date;

  // ความสัมพันธ์
  user?: User;
  stock?: Stock;
}

//โมเดลสำหรับส่งสรุปภาพรวม
export class PortfolioSummary {
  total_market_value: number; // มูลค่าพอร์ตปัจจุบัน
  total_invested: number; // เงินลงทุนสุทธิ
  total_profit_loss: number; // กำไร/ขาดทุนสะสม
  total_return_percent: number; // % ผลตอบแทนรวม
}

//โมเดลสำหรับส่งรายละเอียดหุ้นแต่ละตัวในพอร์ต
export class PortfolioDetail extends Portfolio {
  current_price: number;
  market_value: number; // มูลค่าตลาดของหุ้นตัวนี้
  profit_loss: number; // กำไร/ขาดทุนเฉพาะหุ้นตัวนี้
  return_percent: number; // % ผลตอบแทนเฉพาะหุ้นตัวนี้
}

//โมเดลสำหรับปันผลที่คาดว่าจะได้รับเร็วๆนี้
export interface UpcomingDividend {
  stock_symbol: string;
  ex_dividend_date: Date;
  record_date: Date;
  payment_date: Date;
  shares_eligible: number; // จำนวนหุ้นที่มีสิทธิ์ได้รับ
  estimated_dividend: number; // ยอดปันผลประมาณการ (Gross)
}
