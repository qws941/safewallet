-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('WORKER', 'SITE_ADMIN');

-- CreateEnum
CREATE TYPE "AttendanceResult" AS ENUM ('SUCCESS', 'FAIL');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('FAS', 'MANUAL');

-- CreateEnum
CREATE TYPE "VoteCandidateSource" AS ENUM ('ADMIN', 'AUTO');

-- AlterTable
ALTER TABLE "site_memberships" ADD COLUMN     "role" "MembershipRole" NOT NULL DEFAULT 'WORKER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "dob" TEXT,
ADD COLUMN     "dob_hash" TEXT,
ADD COLUMN     "external_system" TEXT,
ADD COLUMN     "external_worker_id" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone_hash" TEXT,
ADD COLUMN     "trade_type" TEXT;

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "user_id" TEXT,
    "external_worker_id" TEXT,
    "checkin_at" TIMESTAMP(3) NOT NULL,
    "result" "AttendanceResult" NOT NULL,
    "device_id" TEXT,
    "source" "AttendanceSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_policies" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "require_checkin" BOOLEAN NOT NULL DEFAULT true,
    "day_cutoff_hour" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_approvals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "approved_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "valid_date" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_candidates" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "VoteCandidateSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendances_site_id_checkin_at_idx" ON "attendances"("site_id", "checkin_at");

-- CreateIndex
CREATE INDEX "attendances_user_id_checkin_at_idx" ON "attendances"("user_id", "checkin_at");

-- CreateIndex
CREATE INDEX "attendances_external_worker_id_checkin_at_idx" ON "attendances"("external_worker_id", "checkin_at");

-- CreateIndex
CREATE UNIQUE INDEX "access_policies_site_id_key" ON "access_policies"("site_id");

-- CreateIndex
CREATE INDEX "manual_approvals_user_id_valid_date_idx" ON "manual_approvals"("user_id", "valid_date");

-- CreateIndex
CREATE INDEX "manual_approvals_site_id_valid_date_idx" ON "manual_approvals"("site_id", "valid_date");

-- CreateIndex
CREATE INDEX "votes_site_id_month_idx" ON "votes"("site_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "votes_site_id_month_voter_id_key" ON "votes"("site_id", "month", "voter_id");

-- CreateIndex
CREATE INDEX "vote_candidates_site_id_month_idx" ON "vote_candidates"("site_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "vote_candidates_site_id_month_user_id_key" ON "vote_candidates"("site_id", "month", "user_id");

-- CreateIndex
CREATE INDEX "users_phone_hash_dob_hash_idx" ON "users"("phone_hash", "dob_hash");

-- CreateIndex
CREATE INDEX "users_external_system_external_worker_id_idx" ON "users"("external_system", "external_worker_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_approvals" ADD CONSTRAINT "manual_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_approvals" ADD CONSTRAINT "manual_approvals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_approvals" ADD CONSTRAINT "manual_approvals_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_candidates" ADD CONSTRAINT "vote_candidates_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_candidates" ADD CONSTRAINT "vote_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
