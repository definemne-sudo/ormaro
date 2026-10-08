import { getDb, schema } from "@ormaro/db";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "user" | "admin" } & DefaultSession["user"];
  }
}

/**
 * Yalnızca yerelde deneme için: ALLOW_DEV_LOGIN=1 iken e-posta yazarak giriş.
 * Vercel'in canlı ortamında hiçbir koşulda açılmaz.
 */
export const devLoginEnabled =
  process.env.ALLOW_DEV_LOGIN === "1" && process.env.VERCEL_ENV !== "production";

export const googleLoginEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

async function upsertUser(input: { email: string; name?: string | null; image?: string | null }) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL tanımlı değil; kullanıcı kaydedilemedi.");
  const email = input.email.trim().toLowerCase();
  const [row] = await db
    .insert(schema.users)
    .values({ email, name: input.name ?? null, avatarUrl: input.image ?? null })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { avatarUrl: input.image ?? null },
    })
    .returning({ id: schema.users.id, role: schema.users.role });
  if (!row) throw new Error("Kullanıcı kaydedilemedi.");
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleLoginEnabled ? [Google] : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Deneme girişi",
            credentials: { email: { label: "E-posta", type: "email" } },
            authorize: async (credentials) => {
              const email = String(credentials?.email ?? "").trim();
              if (!email.includes("@")) return null;
              return { email, name: email.split("@")[0] };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const row = await upsertUser({ email: user.email, name: user.name, image: user.image });
        token.uid = row.id;
        token.role = row.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") {
        session.user.id = token.uid;
        session.user.role = token.role === "admin" ? "admin" : "user";
      }
      return session;
    },
  },
});
