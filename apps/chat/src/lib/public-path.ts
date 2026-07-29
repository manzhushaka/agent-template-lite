/** Prefix browser-visible paths when the generated project is deployed below an Nginx subpath. */
export function publicPath(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_CHAT_BASE_PATH || "";
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base.replace(/\/$/, "")}${path}`;
}
