import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { LOGIN_CAPTCHA_COOKIE, verifyLoginCaptcha } from "@/lib/login-captcha";

const schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
  captcha: z.string().trim().min(4).max(4),
});

function clearCaptcha(response: NextResponse) {
  response.cookies.set(LOGIN_CAPTCHA_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "请完整填写用户名、密码和验证码" }, { status: 400 });
  const captchaToken = request.cookies.get(LOGIN_CAPTCHA_COOKIE)?.value;
  if (!verifyLoginCaptcha(captchaToken, parsed.data.captcha)) {
    return clearCaptcha(NextResponse.json({ message: "验证码错误或已过期，请刷新后重试" }, { status: 400 }));
  }
  const user = await authenticate(parsed.data.username, parsed.data.password);
  if (!user) return clearCaptcha(NextResponse.json({ message: "用户名或密码错误" }, { status: 401 }));
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", maxAge: 12 * 60 * 60, path: "/",
  });
  return clearCaptcha(response);
}
