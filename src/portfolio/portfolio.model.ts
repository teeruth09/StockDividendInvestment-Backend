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

  total_received_dividends: number; //ปันผลที่ได้รับสุทธิแล้ว
  total_tax_credit: number; //เครดิตภาษีที่ได้รับแล้วรวม
  total_net_return: number; //ผลตอบแทนรวม (P/L + ปันผลรวมเครดิตภาษี)
  net_return_percent: number; //% ผลตอบแทนรวม (Total Net Return / Total Invested)
}

//โมเดลสำหรับส่งรายละเอียดหุ้นแต่ละตัวในพอร์ต
export class PortfolioDetail extends Portfolio {
  current_price: number;
  market_value: number; // มูลค่าตลาดของหุ้นตัวนี้
  profit_loss: number; // กำไร/ขาดทุนเฉพาะหุ้นตัวนี้
  return_percent: number; // % ผลตอบแทนเฉพาะหุ้นตัวนี้

  received_dividend_total: number; //เงินปันผลที่ได้รับแล้วทั้งหมดสำหรับหุ้นตัวนี้
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

// โมเดลสำหรับประวัติมูลค่าพอร์ต (Line Chart)
export interface PortfolioHistoryPoint {
  history_date: Date; // วันที่ของจุดข้อมูล
  market_value: number; // มูลค่าตลาด ณ วันที่นั้น
  cost_basis: number; // ต้นทุนสะสม ณ วันที่นั้น
}

// โมเดลสำหรับการกระจายการลงทุน (Pie Chart)
export interface AllocationItem {
  sector: string; // ชื่อกลุ่มธุรกิจ
  market_value: number; // มูลค่าตลาดของกลุ่มนี้
  percentage: number; // % การกระจาย
}
