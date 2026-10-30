import { logger } from "./logger";
import { validateFlowPayConfig } from "./flowpay";
import { isS3ImageStorageConfigured } from "./s3-image-storage";
import { redisConfigured } from "./redis";

const DEV_SESSION_DEFAULT = "evenum-dev-secret";

export function validateApiStartupConfig(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    logger.fatal("DATABASE_URL is required");
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET?.trim();

  if (isProduction && (!sessionSecret || sessionSecret === DEV_SESSION_DEFAULT)) {
    logger.fatal("SESSION_SECRET must be set to a strong value in production");
    process.exit(1);
  }

  if (isProduction && !process.env.CORS_ALLOWED_ORIGINS?.trim()) {
    logger.fatal("CORS_ALLOWED_ORIGINS is required in production");
    process.exit(1);
  }

  if (isProduction && !isS3ImageStorageConfigured()) {
    logger.fatal("S3-compatible image storage must be configured in production");
    process.exit(1);
  }

  if (isProduction && !redisConfigured) {
    logger.warn(
      "REDIS_URL is not set in production. Shared rate limits, discovery cache, and the maintenance worker will not run across instances.",
    );
  }

  if (isProduction) {
    try {
      validateFlowPayConfig();
    } catch (error) {
      logger.fatal({ err: error }, "FlowPay production configuration is invalid");
      process.exit(1);
    }
  }
}

export function validateWorkerStartupConfig(): void {
  if (!process.env.REDIS_URL?.trim()) {
    logger.fatal("REDIS_URL is required for the ROBLYNE worker");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    logger.fatal("DATABASE_URL is required for the ROBLYNE worker");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    try {
      validateFlowPayConfig();
    } catch (error) {
      logger.fatal({ err: error }, "FlowPay production configuration is required for the payout worker");
      process.exit(1);
    }
  }
}
