import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiResponse } from './api-response';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Maps any thrown value to the standard error envelope (rule.md 5.5 / 9.3).
 *
 * - AppError (and subclasses): returned as-is. These messages are written for users.
 * - ZodError: 422 with the failing field paths.
 * - Known Prisma errors: unique violation → 409, record missing → 404.
 * - Malformed JSON body: 400.
 * - Anything else: logged server-side, generic 500 to the client (no internal message).
 */
export function handleApiError(err: unknown, context: string) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(context, err);
    return ApiResponse.error(err.code, err.message, err.details, err.status);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const summary = details
      .slice(0, 3)
      .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      .join('; ');
    return ApiResponse.error('VALIDATION_ERROR', `Invalid request: ${summary}`, details, 422);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return ApiResponse.error(
        'DUPLICATE_VALUE',
        'A record with this value already exists (for example, the URL slug is already in use).',
        undefined,
        409
      );
    }
    if (err.code === 'P2025') {
      return ApiResponse.notFound();
    }
  }

  if (err instanceof SyntaxError) {
    return ApiResponse.error('INVALID_JSON', 'Request body is not valid JSON.', undefined, 400);
  }

  logger.error(context, err);
  return ApiResponse.serverError();
}
