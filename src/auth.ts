import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/modules/auth/application/password";
import { loginSchema } from "@/modules/auth/application/schemas";

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
      name: "Логин и пароль",
      credentials: {
        identifier: { label: "Email или логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const identifier = parsed.data.identifier.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { login: identifier }],
          },
        });

        if (!user || !user.isActive || user.blockedAt || user.archivedAt) {
          return null;
        }

        const passwordMatches = await verifyPassword(
          user.passwordHash,
          parsed.data.password,
        );
        if (!passwordMatches) {
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
          data: { lastLoginAt: new Date() },
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
