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
