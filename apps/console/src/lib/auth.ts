import { compare } from "bcryptjs";
import { PROJECT_CONFIG } from "@template/shared";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { consoleUsers } from "@/db/schema";
import { db } from "./db";

export const SESSION_COOKIE = `${PROJECT_CONFIG.cookiePrefix}_console_session`;
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "local-development-only-change-me");

export interface SessionUser { id: number; username: string; displayName: string; role: string }

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const [user] = await db.select().from(consoleUsers).where(eq(consoleUsers.username, username)).limit(1);
  if (!user || user.status !== "ACTIVE" || !await compare(password, user.passwordHash)) return null;
  await db.update(consoleUsers).set({ lastLoginAt: new Date() }).where(eq(consoleUsers.id, user.id));
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username, displayName: user.displayName, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime("12h").sign(secret);
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: Number(payload.sub), username: String(payload.username), displayName: String(payload.displayName), role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

/** Internal APIs authenticate services, never browser sessions. */
export function internalAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;
  return Boolean(expected && provided && provided === expected);
}
