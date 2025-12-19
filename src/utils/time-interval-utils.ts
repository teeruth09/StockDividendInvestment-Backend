/**
 * คำนวณวันที่เริ่มต้นย้อนหลังตาม Interval ที่กำหนด
 * @param interval '1W', '1M', '3M', '6M', '1Y'
 * @returns Date object สำหรับวันที่เริ่มต้น (00:00:00 ของวันนั้น)
 */
export function getStartDateFromInterval(interval: string): Date {
  const today = new Date();
  const startDate = new Date(today);

  // ตั้งเวลาให้เป็น 00:00:00 เพื่อให้ครอบคลุมทั้งวัน
  startDate.setHours(0, 0, 0, 0);

  switch (interval) {
    case '1W': // 7 วัน
      startDate.setDate(today.getDate() - 7);
      break;
    case '1M': // 1 เดือน
      startDate.setMonth(today.getMonth() - 1);
      break;
    case '3M': // 3 เดือน
      startDate.setMonth(today.getMonth() - 3);
      break;
    case '6M': // 6 เดือน
      startDate.setMonth(today.getMonth() - 6);
      break;
    case '1Y': // 1 ปี
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    default:
      // Default: 1 เดือน
      startDate.setMonth(today.getMonth() - 1);
      break;
  }
  return startDate;
}
