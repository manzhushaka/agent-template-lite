export function publicPath(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_CONSOLE_BASE_PATH || "";
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base.replace(/\/$/, "")}${path}`;
}
