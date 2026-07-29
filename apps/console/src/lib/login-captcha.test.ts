import { beforeEach, describe, expect, it } from "vitest";
import { createLoginCaptcha, verifyLoginCaptcha } from "./login-captcha";

describe("login captcha", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-only-auth-secret-with-enough-entropy";
  });

  it("accepts the signed code once it is normalized", () => {
    const captcha = createLoginCaptcha(1_000, "AB23");
    expect(verifyLoginCaptcha(captcha.token, " ab23 ", 2_000)).toBe(true);
  });

  it("rejects an incorrect or expired answer", () => {
    const captcha = createLoginCaptcha(1_000, "AB23");
    expect(verifyLoginCaptcha(captcha.token, "AB24", 2_000)).toBe(false);
    expect(verifyLoginCaptcha(captcha.token, "AB23", 302_000)).toBe(false);
  });

  it("rejects a token whose signature was changed", () => {
    const captcha = createLoginCaptcha(1_000, "AB23");
    expect(verifyLoginCaptcha(`${captcha.token}x`, "AB23", 2_000)).toBe(false);
  });
});
