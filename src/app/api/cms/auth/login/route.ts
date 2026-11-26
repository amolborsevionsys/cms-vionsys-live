import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { comparePasswords, attachSessionCookie, hashPassword } from '@/features/auth/auth-options';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * Credentials allowed to create the very first SUPER_ADMIN on an empty database.
 * - Production: only when CMS_BOOTSTRAP_ADMIN_EMAIL / CMS_BOOTSTRAP_ADMIN_PASSWORD are set.
 * - Development: those, or the local default admin@vionsys.com / admin123.
 * Once any user exists this path is never used (rule.md 7.3).
 */
function getBootstrapCredentials(): { email: string; password: string } | null {
  if (env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD) {
    return { email: env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(), password: env.BOOTSTRAP_ADMIN_PASSWORD };
  }
  if (!env.IS_PRODUCTION) {
    return { email: 'admin@vionsys.com', password: 'admin123' };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiResponse.error('MISSING_FIELDS', 'Email and password are required.', null, 400);
    }

    const { password } = parsed.data;
    const normalizedEmail = parsed.data.email.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Bootstrap the first admin if the database has no users yet.
    if (!user) {
      const bootstrap = getBootstrapCredentials();
      if (
        bootstrap &&
        normalizedEmail === bootstrap.email &&
        password === bootstrap.password &&
        (await prisma.user.count()) === 0
      ) {
        user = await prisma.user.create({
          data: {
            email: bootstrap.email,
            name: 'Super Admin User',
            passwordHash: await hashPassword(bootstrap.password),
            role: 'SUPER_ADMIN',
          },
        });
      }
    }

    if (!user) {
      return ApiResponse.error('INVALID_CREDENTIALS', 'Invalid email or password.', null, 401);
    }

    const isValid = await comparePasswords(password, user.passwordHash);
    if (!isValid) {
      return ApiResponse.error('INVALID_CREDENTIALS', 'Invalid email or password.', null, 401);
    }

    const response = ApiResponse.success({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    return attachSessionCookie(response, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err: unknown) {
    return handleApiError(err, 'Login route error');
  }
}
export const dynamic = 'force-dynamic';
