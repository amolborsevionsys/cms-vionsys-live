import { ApiResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * Error envelope for the AI routes: AppError messages are written for users;
 * anything else is logged and returned as a generic 500 (no internal details).
 * (The hardening branch adds a shared handleApiError; switch to it after merging.)
 */
export function toErrorResponse(err: unknown, context: string) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(context, err);
    return ApiResponse.error(err.code, err.message, err.details, err.status);
  }
  logger.error(context, err);
  return ApiResponse.serverError();
}
