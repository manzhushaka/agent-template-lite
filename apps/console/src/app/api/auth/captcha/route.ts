import { NextResponse } from "next/server";
import {
  createLoginCaptcha,
  LOGIN_CAPTCHA_COOKIE,
  LOGIN_CAPTCHA_MAX_AGE_SECONDS,
  renderLoginCaptchaSvg,
} from "@/lib/login-captcha";

export async function GET() {
  const captcha = createLoginCaptcha();
  const response = new NextResponse(renderLoginCaptchaSvg(captcha.code), {
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "image/svg+xml; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
  response.cookies.set(LOGIN_CAPTCHA_COOKIE, captcha.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: LOGIN_CAPTCHA_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
