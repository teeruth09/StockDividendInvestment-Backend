//ฟังก์ชันสำหรับล้างเวลาให้เหลือแค่วันที่
export const normalizeDate = (date: Date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
