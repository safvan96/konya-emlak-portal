import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { createLog } from "./log";
import { rateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email ve şifre gerekli");
        }

        // Login rate limiting: 10 deneme / dakika per email
        const rl = rateLimit(`login:${credentials.email}`, 10, 60 * 1000);
        if (!rl.success) {
          throw new Error("Çok fazla giriş denemesi. Lütfen 1 dakika bekleyin.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) {
          throw new Error("Geçersiz email veya şifre");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          throw new Error("Geçersiz email veya şifre");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.role,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await createLog(user.id, "LOGIN", "Kullanıcı giriş yaptı");
      }
    },
    async signOut({ token }) {
      if (token?.id) {
        await createLog(token.id as string, "LOGOUT", "Kullanıcı çıkış yaptı");
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.surname = user.surname;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.surname = token.surname;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
