import { getDb, schema } from "@ormaro/db";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { consumeTicket, findUserByEmail, isEmail, normalizeEmail } from "@/lib/emailAuth";
import { verifyPassword } from "@/lib/password";

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

/** ADMIN_EMAILS: virgülle ayrılmış yönetici e-postaları. Bu adreslerle girenler yönetici olur. */
function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

async function upsertUser(input: { email: string; name?: string | null; image?: string | null }) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL tanımlı değil; kullanıcı kaydedilemedi.");
  const email = input.email.trim().toLowerCase();
  const admin = isAdminEmail(email);
  const [row] = await db
    .insert(schema.users)
    .values({
      email,
      name: input.name ?? null,
      avatarUrl: input.image ?? null,
      role: admin ? "admin" : "user",
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: {
        email,
        // Şifreyle girişte resim gelmez; Google'dan gelen resim silinmesin.
        ...(input.image ? { avatarUrl: input.image } : {}),
        ...(admin ? { role: "admin" as const } : {}),
      },
    })
    .returning({ id: schema.users.id, role: schema.users.role, bannedAt: schema.users.bannedAt });
  if (!row) throw new Error("Kullanıcı kaydedilemedi.");
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleLoginEnabled ? [Google] : []),
    Credentials({
      id: "password",
      name: "E-posta ve şifre",
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        if (!isEmail(email) || !password || password.length > 200) return null;
        const user = await findUserByEmail(email);
        if (!user?.passwordHash || !user.emailVerifiedAt) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        return { email: user.email, name: user.name };
      },
    }),
    Credentials({
      // E-posta kodu doğrulandıktan sonra verilen tek kullanımlık biletle giriş.
      id: "ticket",
      name: "E-posta kodu",
      credentials: { email: {}, ticket: {} },
      authorize: async (credentials) => {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const ticket = String(credentials?.ticket ?? "");
        if (!isEmail(email) || !ticket) return null;
        const user = await consumeTicket(email, ticket);
        return user ? { email: user.email, name: user.name } : null;
      },
    }),
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
        // Engellenmiş hesap oturum açamaz.
        if (row.bannedAt) throw new Error("banned");
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
