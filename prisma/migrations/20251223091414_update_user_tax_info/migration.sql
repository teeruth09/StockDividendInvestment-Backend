/*
  Warnings:

  - You are about to drop the column `annual_income` on the `UserTaxInfo` table. All the data in the column will be lost.
  - You are about to drop the column `health_insurance_deduction` on the `UserTaxInfo` table. All the data in the column will be lost.
  - You are about to drop the column `life_insurance_deduction` on the `UserTaxInfo` table. All the data in the column will be lost.
  - You are about to drop the column `provident_fund_deduction` on the `UserTaxInfo` table. All the data in the column will be lost.
  - You are about to drop the column `retirement_mutual_fund` on the `UserTaxInfo` table. All the data in the column will be lost.
  - You are about to drop the column `tax_bracket` on the `UserTaxInfo` table. All the data in the column will be lost.
  - Made the column `personal_deduction` on table `UserTaxInfo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `spouse_deduction` on table `UserTaxInfo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `child_deduction` on table `UserTaxInfo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parent_deduction` on table `UserTaxInfo` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserTaxInfo" DROP COLUMN "annual_income",
DROP COLUMN "health_insurance_deduction",
DROP COLUMN "life_insurance_deduction",
DROP COLUMN "provident_fund_deduction",
DROP COLUMN "retirement_mutual_fund",
DROP COLUMN "tax_bracket",
ADD COLUMN     "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "disabled_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "donation_education" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "donation_general" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "health_insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "home_loan_interest" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "life_insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "other_income" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "parent_health_insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pvd_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rmf_investment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "social_security" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ssf_investment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "thaiesg_investment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "personal_deduction" SET NOT NULL,
ALTER COLUMN "personal_deduction" SET DEFAULT 60000,
ALTER COLUMN "spouse_deduction" SET NOT NULL,
ALTER COLUMN "spouse_deduction" SET DEFAULT 0,
ALTER COLUMN "child_deduction" SET NOT NULL,
ALTER COLUMN "child_deduction" SET DEFAULT 0,
ALTER COLUMN "parent_deduction" SET NOT NULL,
ALTER COLUMN "parent_deduction" SET DEFAULT 0;
