import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const LOGIN_CAPTCHA_COOKIE = "agent_template_login_captcha";
export const LOGIN_CAPTCHA_MAX_AGE_SECONDS = 5 * 60;

const CAPTCHA_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CAPTCHA_CODE_LENGTH = 4;

interface CaptchaPayload {
  code: string;
  expiresAt: number;
  nonce: string;
}

function captchaSecret(): string {
  return process.env.AUTH_SECRET || "local-development-only-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", captchaSecret()).update(payload).digest("base64url");
}

function randomCaptchaCode(): string {
  return Array.from(
    { length: CAPTCHA_CODE_LENGTH },
    () => CAPTCHA_CHARACTERS[randomInt(CAPTCHA_CHARACTERS.length)],
  ).join("");
}

export function createLoginCaptcha(now = Date.now(), code = randomCaptchaCode()) {
  const payload: CaptchaPayload = {
    code: code.toUpperCase(),
    expiresAt: now + LOGIN_CAPTCHA_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(8).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    code: payload.code,
    token: `${encodedPayload}.${sign(encodedPayload)}`,
  };
}

export function verifyLoginCaptcha(token: string | undefined, answer: string, now = Date.now()): boolean {
  if (!token) return false;
  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return false;

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<CaptchaPayload>;
    return typeof payload.code === "string"
      && typeof payload.expiresAt === "number"
      && payload.expiresAt >= now
      && payload.code === answer.trim().toUpperCase();
  } catch {
    return false;
  }
}

export function renderLoginCaptchaSvg(code: string): string {
  const letters = [...code].map((letter, index) => {
    const x = 26 + index * 29 + randomInt(-2, 3);
    const y = 35 + randomInt(-3, 4);
    const rotation = randomInt(-13, 14);
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})">${letter}</text>`;
  }).join("");
  const lines = Array.from({ length: 3 }, () => {
    const y1 = randomInt(8, 42);
    const y2 = randomInt(8, 42);
    return `<path d="M4 ${y1} L144 ${y2}" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="148" height="48" viewBox="0 0 148 48" role="img" aria-label="登录验证码">
  <rect width="148" height="48" rx="9" fill="#faf8f3" />
  <g fill="none" stroke="#d8d2c7" stroke-width="1">${lines}</g>
  <g fill="#d83f12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" font-weight="700">${letters}</g>
</svg>`;
}
