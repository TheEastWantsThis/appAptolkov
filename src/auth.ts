import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import {
  nextLoginUnlockTime,
  shouldLockLogin,
} from "@/modules/auth/application/login-protection";
import { verifyPassword } from "@/modules/auth/application/password";
import { loginSchema } from "@/modules/auth/application/schemas";
import { isValidNormalizedPhone, normalizePhone } from "@/shared/domain/phone";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Телефон и пароль",
      credentials: {
        phone: { label: "Номер телефона", type: "tel" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const phoneNormalized = normalizePhone(parsed.data.phone);
        if (!isValidNormalizedPhone(phoneNormalized)) {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { phoneNormalized },
        });

        if (
          !user ||
          !user.isActive ||
          user.blockedAt ||
          user.archivedAt ||
          (user.loginLockedUntil && user.loginLockedUntil > new Date())
        ) {
          return null;
        }

        const passwordMatches = await verifyPassword(
          user.passwordHash,
          parsed.data.password,
        );
        if (!passwordMatches) {
          const failed = await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } },
            select: { failedLoginAttempts: true },
          });
          if (shouldLockLogin(failed.failedLoginAttempts)) {
            const loginLockedUntil = nextLoginUnlockTime();
            await prisma.$transaction([
              prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, loginLockedUntil },
              }),
              prisma.auditLog.create({
                data: {
                  actorId: null,
                  action: "AUTH_LOGIN_LOCKED",
                  entityType: "User",
                  entityId: user.id,
                  summary: "Вход временно заблокирован после неверных попыток",
                  metadata: { loginLockedUntil },
                },
              }),
            ]);
          }
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      const userId = typeof token.userId === "string" ? token.userId : null;
      const sessionVersion =
        typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      if (session.user && userId) {
        session.user.id = userId;
        session.user.sessionVersion = sessionVersion;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            loginLockedUntil: null,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "AUTH_LOGIN",
            entityType: "User",
            entityId: user.id,
            summary: "Вход в систему",
          },
        }),
      ]);
    },
  },
});
