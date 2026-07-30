import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PROJECT_CONFIG } from "@template/shared";

export const VISITOR_COOKIE = `${PROJECT_CONFIG.cookiePrefix}_visitor`;
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.CHAT_VISITOR_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("CHAT_VISITOR_SECRET 或 AUTH_SECRET 未配置");
  return value;
}

function signature(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function cookieValue(request: Request): string | undefined {
  const header = request.headers.get("cookie") || "";
  return header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1);
}

export interface VisitorIdentity { id: string; token: string; isNew: boolean }

export function visitorIdentity(request: Request): VisitorIdentity {
  const token = cookieValue(request);
  if (token) {
    const [id, expiresAt, provided, extra] = token.split(".");
    const payload = `${id}.${expiresAt}`;
    const expected = signature(payload);
    const providedBuffer = Buffer.from(provided || "");
    const expectedBuffer = Buffer.from(expected);
    if (!extra && /^[0-9a-f-]{36}$/i.test(id) && Number(expiresAt) > Date.now()
      && providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { id, token, isNew: false };
    }
  }
  const id = randomUUID();
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${id}.${expiresAt}`;
  return { id, token: `${payload}.${signature(payload)}`, isNew: true };
}

export function visitorCookie(identity: VisitorIdentity): string {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${identity.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function attachVisitorCookie(response: Response, identity: VisitorIdentity): Response {
  if (identity.isNew) response.headers.append("set-cookie", visitorCookie(identity));
  return response;
}
