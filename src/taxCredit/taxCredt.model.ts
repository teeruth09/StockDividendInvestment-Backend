// import { User } from 'src/user/user.model'; // สมมติว่ามี User model
import { DividendReceived } from 'src/dividend/dividend.model';
/**
 * Class/Interface สำหรับเครดิตภาษี (TaxCredit)
 * ตรงกับ Prisma Model
 */
export class TaxCredit {
  credit_id: string;
  received_id: string;
  user_id: string;
  tax_year: number;
  corporate_tax_rate: number;
  tax_credit_amount: number;
  taxable_income: number;
  tax_saving?: number | null;
  is_used: boolean;

  // ความสัมพันธ์ (Optional fields)
  // user?: User;
  dividendReceived?: DividendReceived;
}
