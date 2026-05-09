/*
  Warnings:

  - Added the required column `disabledAt` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "disabledAt" TIMESTAMP(3) NOT NULL;
