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
  existingDates: Set<number>,
): Array<{ from: Date; to: Date }> {
  const ranges: Array<{ from: Date; to: Date }> = [];

  let cursor = normalizeDate(start);
  const endDay = normalizeDate(end);

  let rangeStart: Date | null = null;

  while (cursor <= endDay) {
    const key = cursor.getTime();
    const exists = existingDates.has(key);

    if (!exists && !rangeStart) {
      rangeStart = new Date(cursor);
    }

    if ((exists || cursor.getTime() === endDay.getTime()) && rangeStart) {
      const rangeEnd = exists ? addDays(cursor, -1) : new Date(cursor);

      ranges.push({ from: rangeStart, to: rangeEnd });
      rangeStart = null;
    }

    cursor = addDays(cursor, 1);
  }

  return ranges;
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
