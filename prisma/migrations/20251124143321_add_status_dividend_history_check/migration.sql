-- AlterTable
ALTER TABLE "Dividend" ADD COLUMN     "calculated_at" TIMESTAMP(3),
ADD COLUMN     "calculation_status" TEXT NOT NULL DEFAULT 'PENDING';
