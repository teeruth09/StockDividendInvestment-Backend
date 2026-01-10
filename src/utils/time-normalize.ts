//ฟังก์ชันสำหรับล้างเวลาให้เหลือแค่วันที่
export const normalizeDate = (date: Date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

//ช่วยเรื่องการดึงข้อมูลราคาหุ้น
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function findMissingRanges(
  start: Date,
  end: Date,
  dbDates: Set<number>,
  holidayDates: Set<number>, // รับ Set ของวันหยุดเพิ่ม
) {
  const missing: { from: Date; to: Date }[] = [];
  const current = new Date(start);
  const today = new Date().setUTCHours(0, 0, 0, 0);
  let rangeStart: Date | null = null;

  while (current <= end) {
    const currentTime = normalizeDate(current).getTime();
    const dayOfWeek = current.getDay();

    //เงื่อนไขสำคัญ:
    // 1. ต้องไม่ใช่เสาร์ (6) และอาทิตย์ (0)
    // 2. ต้องไม่ใช่ "วันนี้" (เพราะข้อมูลยังไม่มา/ไม่สมบูรณ์)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = currentTime === today;
    const isHoliday = holidayDates.has(currentTime); // เช็คว่าอยู่ในตารางวันหยุดไหม
    const existsInDb = dbDates.has(currentTime);

    if (!existsInDb && !isWeekend && !isToday && !isHoliday) {
      if (!rangeStart) rangeStart = new Date(current);
    } else {
      if (rangeStart) {
        // ถอยหลังไป 1 วันจาก current เพื่อปิดช่วง range ที่ขาด
        const rangeEnd = new Date(current);
        rangeEnd.setDate(rangeEnd.getDate() - 1);
        missing.push({ from: rangeStart, to: rangeEnd });
        rangeStart = null;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  // เก็บช่วงสุดท้ายถ้ายังมีค้างอยู่
  if (rangeStart) {
    missing.push({ from: rangeStart, to: new Date(end) });
  }

  return missing;
}

export function splitRange(
  from: Date,
  to: Date,
  maxDays = 90,
): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);

  while (cursor <= to) {
    const chunkEnd = addDays(cursor, maxDays - 1);
    chunks.push({
      from: new Date(cursor),
      to: chunkEnd < to ? chunkEnd : to,
    });
    cursor = addDays(chunkEnd, 1);
  }

  return chunks;
}
