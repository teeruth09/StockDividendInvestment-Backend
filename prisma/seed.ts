// ===== ไฟล์ prisma/seed.ts (แทนที่ไฟล์เดิมทั้งหมด) =====

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import Papa from 'papaparse';

const prisma = new PrismaClient();

// ===== Utility Functions =====

function cleanString(str: string): string {
  if (!str) return '';
  return str
    .replace(/^['"`]|['"`]$/g, '') // ลบ quotes
    .replace(/\r?\n|\r/g, '') // ลบ line breaks
    .trim(); // ลบ whitespace
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  const cleaned = cleanString(value).toLowerCase();
  return cleaned === 'true' || cleaned === '1' || cleaned === 'yes';
}

function parseFloat(value: string): number {
  if (!value) return 0;
  const cleaned = cleanString(value);
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  const cleaned = cleanString(dateString); // ลบ whitespace

  // ถ้าเป็น DD/MM/YYYY หรือ D/M/YYYY
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day); // month-1 เพราะ JavaScript month index 0-11
  }

  // fallback
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date;
}

async function readCSV(filePath: string): Promise<any[]> {
  console.log(`🔍 Reading CSV file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return [];
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    let csvContent = fileBuffer.toString('utf8');

    if (csvContent.includes('�')) {
      console.log('⚠️ Detected encoding issues, trying latin1...');
      csvContent = fileBuffer.toString('latin1');
    }

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => cleanString(header),
      transform: (value: string) => cleanString(value),
    });

    if (parseResult.errors.length > 0) {
      console.error(
        `❌ CSV parsing errors in ${filePath}:`,
        parseResult.errors,
      );
      return [];
    }

    console.log(
      `✅ Successfully parsed ${parseResult.data.length} rows from ${filePath}`,
    );
    return parseResult.data as any[];
  } catch (error) {
    console.error(`💥 Error reading ${filePath}:`, error);
    return [];
  }
}

// ===== Seed Functions for Each Table =====

async function seedStockData() {
  console.log('\n📈 Starting Stock data seeding...');

  const data = await readCSV('./prisma/data/dataStock.csv');
  if (data.length === 0) return { success: 0, errors: 0 };

  let successCount = 0;
  let errorCount = 0;

  for (const [index, row] of data.entries()) {
    try {
      const stockSymbol = cleanString(row.stock_symbol);
      const name = cleanString(row.name);
      const sector = cleanString(row.sector);
      const corporateTaxRate = parseFloat(row.corporate_tax_rate) / 100;
      const boiSupport = parseBoolean(row.boi_support);

      if (!stockSymbol || !name) {
        console.warn(
          `⚠️ Stock Row ${index + 1}: Missing required fields, skipping`,
        );
        errorCount++;
        continue;
      }

      await prisma.stock.upsert({
        where: { stock_symbol: stockSymbol },
        update: {
          name,
          sector,
          corporate_tax_rate: corporateTaxRate,
          boi_support: boiSupport,
        },
        create: {
          stock_symbol: stockSymbol,
          name,
          sector,
          corporate_tax_rate: corporateTaxRate,
          boi_support: boiSupport,
        },
      });

      successCount++;

      if (successCount % 50 === 0) {
        console.log(`📈 Stock progress: ${successCount}/${data.length}`);
      }
    } catch (error) {
      console.error(`❌ Error processing stock row ${index + 1}:`, error);
      errorCount++;
    }
  }

  return { success: successCount, errors: errorCount };
}

async function seedDividendData() {
  console.log('\n💰 Starting Dividend data seeding...');

  const data = await readCSV('./prisma/data/dataDividend.csv');
  if (data.length === 0) return { success: 0, errors: 0 };

  let successCount = 0;
  let errorCount = 0;

  for (const [index, row] of data.entries()) {
    try {
      const dividendId = row.dividend_id;
      const stockSymbol = cleanString(row.stock_symbol);
      const announcementDate = parseDate(row.announcement_date);
      const exDividendDate = parseDate(row.ex_dividend_date);
      const recordDate = parseDate(row.record_date);
      const paymentDate = parseDate(row.payment_date);
      const dividendPerShare = parseFloat(row.dividend_per_share);
      const sourceOfDividend = cleanString(row.source_of_dividend) || null;

      // Validation
      if (
        !stockSymbol ||
        !announcementDate ||
        !exDividendDate ||
        !recordDate ||
        !paymentDate ||
        dividendPerShare <= 0
      ) {
        console.warn(
          `⚠️ Dividend Row ${index + 1}: Missing/invalid required fields, skipping`,
        );
        errorCount++;
        continue;
      }

      // ตรวจสอบว่า stock มีอยู่หรือไม่
      const existingStock = await prisma.stock.findUnique({
        where: { stock_symbol: stockSymbol },
      });

      if (!existingStock) {
        console.warn(
          `⚠️ Dividend Row ${index + 1}: Stock ${stockSymbol} not found, skipping`,
        );
        errorCount++;
        continue;
      }

      await prisma.dividend.upsert({
        where: { dividend_id: dividendId },
        update: {
          stock_symbol: stockSymbol,
          announcement_date: announcementDate,
          ex_dividend_date: exDividendDate,
          record_date: recordDate,
          payment_date: paymentDate,
          dividend_per_share: dividendPerShare,
          source_of_dividend: sourceOfDividend,
        },
        create: {
          dividend_id: dividendId,
          stock_symbol: stockSymbol,
          announcement_date: announcementDate,
          ex_dividend_date: exDividendDate,
          record_date: recordDate,
          payment_date: paymentDate,
          dividend_per_share: dividendPerShare,
          source_of_dividend: sourceOfDividend,
        },
      });
      successCount++;
      if (successCount % 50 === 0) {
        console.log(`📈 Stock progress: ${successCount}/${data.length}`);
      }
    } catch (error) {
      console.error(`❌ Error processing dividend row ${index + 1}:`, error);
      errorCount++;
    }
  }

  return { success: successCount, errors: errorCount };
}

async function seedHistoricalPriceData() {
  console.log('\n📊 Starting Historical Price data seeding...');

  const data = await readCSV('./prisma/data/dataHistoricalPrice.csv');
  if (data.length === 0) return { success: 0, errors: 0 };

  let successCount = 0;
  let errorCount = 0;

  // Process in batches for better performance
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    try {
      const batchData = batch
        .map((row, index) => {
          const stockSymbol = cleanString(row.stock_symbol);
          const priceDate = parseDate(row.price_date);
          const openPrice = parseFloat(row.open_price);
          const highPrice = parseFloat(row.high_price);
          const lowPrice = parseFloat(row.low_price);
          const closePrice = parseFloat(row.close_price);
          const volumeShares = BigInt(
            Math.floor(parseFloat(row.volume_shares) || 0),
          );
          const volumeValue = BigInt(
            Math.floor(parseFloat(row.volume_value) || 0),
          );

          if (!stockSymbol || !priceDate || openPrice <= 0) {
            console.warn(
              `⚠️ Historical Price Row ${i + index + 1}: Invalid data, skipping`,
            );
            return null;
          }

          return {
            stock_symbol: stockSymbol,
            price_date: priceDate,
            open_price: openPrice,
            high_price: highPrice,
            low_price: lowPrice,
            close_price: closePrice,
            price_change: closePrice - openPrice,
            percent_change:
              openPrice > 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0,
            volume_shares: volumeShares,
            volume_value: volumeValue,
          };
        })
        .filter((item) => item !== null);

      if (batchData.length > 0) {
        await prisma.historicalPrice.createMany({
          data: batchData,
          skipDuplicates: true,
        });
        successCount += batchData.length;
      }

      console.log(
        `📊 Historical Price progress: ${Math.min(i + batchSize, data.length)}/${data.length}`,
      );
    } catch (error) {
      console.error(
        `❌ Error processing historical price batch ${i}-${i + batchSize}:`,
        error,
      );
      errorCount += batch.length;
    }
  }

  return { success: successCount, errors: errorCount };
}

// ===== Main Seed Function =====

async function main() {
  try {
    // Optional: Clear existing data
    // await clearData();

    // Seed in dependency order
    const stockResult = await seedStockData();
    const dividendResult = await seedDividendData();
    const historicalPriceResult = await seedHistoricalPriceData();

    // Summary
    console.log('\n🎉 Seeding completed!');
    console.log('📊 Final Summary:');
    console.log(
      `📈 Stocks: ✅ ${stockResult.success} success, ❌ ${stockResult.errors} errors`,
    );
    console.log(
      `💰 Dividends: ✅ ${dividendResult.success} success, ❌ ${dividendResult.errors} errors`,
    );
    console.log(
      `📊 Historical Prices: ✅ ${historicalPriceResult.success} success, ❌ ${historicalPriceResult.errors} errors`,
    );

    // Final counts
    const counts = await Promise.all([
      prisma.stock.count(),
      prisma.dividend.count(),
      prisma.historicalPrice.count(),
    ]);

    console.log(`\n📈 Total records in database:`);
    console.log(`   • Stocks: ${counts[0]}`);
    console.log(`   • Dividends: ${counts[1]}`);
    console.log(`   • Historical Prices: ${counts[2]}`);
  } catch (error) {
    console.error('💥 Fatal error during seeding:', error);
    throw error;
  }
}

// Optional: Clear data function
async function clearData() {
  console.log('🗑️ Clearing existing data...');

  // Delete in reverse dependency order
  await prisma.taxCredit.deleteMany();
  await prisma.dividendReceived.deleteMany();
  await prisma.userTaxInfo.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.historicalPrice.deleteMany();
  await prisma.dividend.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Data cleared successfully');
}

main()
  .catch((e) => {
    console.error('💥 Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
