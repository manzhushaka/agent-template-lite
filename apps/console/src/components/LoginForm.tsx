"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { publicPath } from "@/lib/public-path";

export function LoginForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) alertRef.current?.focus(); }, [message]);
  function refreshCaptcha(form?: HTMLFormElement) {
    setCaptchaVersion((value) => value + 1);
    const input = form?.elements.namedItem("captcha");
    if (input instanceof HTMLInputElement) input.value = "";
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const payload = Object.fromEntries(new FormData(form));
      const response = await fetch(publicPath("/api/auth/login"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.message || "登录失败");
        refreshCaptcha(form);
        return;
      }
      window.location.assign(publicPath("/dashboard"));
    } catch {
      setMessage("登录服务暂时不可用，请稍后重试");
      refreshCaptcha(form);
    } finally {
      setBusy(false);
    }
  }
  const captchaUrl = publicPath("/api/auth/captcha");
  return <form className="login-form" onSubmit={submit} aria-busy={busy}><header><small>身份验证 · AUTHENTICATION</small><h2>登录管理后台</h2><p>使用初始化时生成的管理员账号继续。</p></header>{message && <p className="form-alert" ref={alertRef} tabIndex={-1} role="alert"><CircleAlert size={17} />{message}</p>}<div className="field-group"><label htmlFor="username">用户名</label><div className="field-shell"><UserRound size={17} /><input id="username" name="username" autoComplete="username" defaultValue="admin" required aria-invalid={Boolean(message)} /></div></div><div className="field-group"><label htmlFor="password">密码</label><div className="field-shell"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required aria-invalid={Boolean(message)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"} title={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div><div className="field-group"><label htmlFor="captcha">验证码</label><div className="captcha-row"><div className="field-shell"><input id="captcha" name="captcha" autoComplete="off" inputMode="text" maxLength={4} placeholder="输入图中字符" required aria-invalid={Boolean(message)} /></div><button type="button" className="captcha-refresh" onClick={() => refreshCaptcha()} aria-label="刷新验证码" title="刷新验证码"><Image key={captchaVersion} unoptimized src={captchaUrl} alt="登录验证码" width={148} height={48} /><RefreshCw size={15} /></button></div></div><button className="login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}{busy ? "登录中..." : "登录"}</button><p className="security-note"><ShieldCheck size={16} /><span>访问受验证码、HttpOnly Cookie 与操作审计保护</span></p></form>;
}
