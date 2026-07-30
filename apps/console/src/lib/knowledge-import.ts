import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { load } from "cheerio";
import { z } from "zod";

type PdfParser = (buffer: Buffer) => Promise<{ text: string; info?: Record<string, unknown> }>;
const parsePdf = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js") as PdfParser;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_WEB_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_CHARACTERS = 100_000;
const supportedTypes = new Set([
  "application/pdf",
  "text/html",
  "text/markdown",
  "text/plain",
]);

export interface ImportedKnowledge {
  title: string;
  category: string;
  content: string;
  source: string;
  sourceType: "FILE" | "WEB";
  sourceUri: string | null;
  sourceHash: string;
  mimeType: string;
  fileName: string | null;
  fileSize: number;
  status: "DRAFT" | "PUBLISHED";
}

const fieldsSchema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(80),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  sourceType: z.enum(["FILE", "WEB"]),
  url: z.string().trim().max(1000).optional(),
});

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("::ffff:127.");
}

async function assertPublicWebUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw new Error("仅支持不带账号密码的 HTTP/HTTPS 网页地址");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("网页地址不能指向本机或内网");
  }
  return url;
}

function normalizeMimeType(value: string): string {
  return value.split(";", 1)[0].trim().toLowerCase();
}

function htmlText(buffer: Buffer): { content: string; title: string } {
  const document = load(buffer.toString("utf8"));
  document("script,style,noscript,svg,nav,footer").remove();
  const title = document("title").first().text().trim();
  const content = document("main,article").first().text() || document("body").text();
  return { title, content: content.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim() };
}

async function extractContent(buffer: Buffer, mimeType: string): Promise<{ content: string; title: string }> {
  if (mimeType === "application/pdf") {
    const parsed = await parsePdf(buffer);
    return { content: parsed.text.trim(), title: String(parsed.info?.Title || "").trim() };
  }
  if (mimeType === "text/html") return htmlText(buffer);
  return { content: buffer.toString("utf8").trim(), title: "" };
}

function validateContent(content: string): string {
  if (content.length < 20) throw new Error("导入内容少于 20 个字符");
  if (content.length > MAX_CONTENT_CHARACTERS) throw new Error("导入正文不能超过 100000 个字符");
  return content;
}

async function fetchWebResource(initialUrl: string): Promise<{ buffer: Buffer; mimeType: string; url: URL }> {
  let url = await assertPublicWebUrl(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": "AgentTemplateLiteKnowledgeImporter/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("网页重定向次数过多");
      url = await assertPublicWebUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`网页请求失败（${response.status}）`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_WEB_BYTES) throw new Error("网页内容不能超过 2MB");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_WEB_BYTES) throw new Error("网页内容不能超过 2MB");
    return {
      buffer,
      mimeType: normalizeMimeType(response.headers.get("content-type") || "text/html"),
      url,
    };
  }
  throw new Error("网页导入失败");
}

/** Parse external sources at the Console boundary before content reaches MySQL or AgentOS. */
export async function parseKnowledgeImport(formData: FormData): Promise<ImportedKnowledge> {
  const parsed = fieldsSchema.safeParse({
    title: formData.get("title") || undefined,
    category: formData.get("category"),
    status: formData.get("status"),
    sourceType: formData.get("sourceType"),
    url: formData.get("url") || undefined,
  });
  if (!parsed.success) throw new Error("请检查导入类型、分类和发布状态");

  let buffer: Buffer;
  let mimeType: string;
  let sourceUri: string | null = null;
  let fileName: string | null = null;
  if (parsed.data.sourceType === "FILE") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("请选择要导入的文件");
    if (file.size > MAX_FILE_BYTES) throw new Error("导入文件不能超过 5MB");
    mimeType = normalizeMimeType(file.type || "text/plain");
    if (!supportedTypes.has(mimeType)) throw new Error("仅支持 PDF、HTML、Markdown 和纯文本文件");
    buffer = Buffer.from(await file.arrayBuffer());
    fileName = file.name.slice(0, 255);
  } else {
    if (!parsed.data.url) throw new Error("请输入网页地址");
    const resource = await fetchWebResource(parsed.data.url);
    buffer = resource.buffer;
    mimeType = resource.mimeType;
    sourceUri = resource.url.toString();
    if (!supportedTypes.has(mimeType)) throw new Error(`不支持网页内容类型：${mimeType || "未知"}`);
  }

  const extracted = await extractContent(buffer, mimeType);
  const content = validateContent(extracted.content);
  const fallbackTitle = fileName?.replace(/\.[^.]+$/, "") || extracted.title || (sourceUri ? new URL(sourceUri).hostname : "导入知识");
  const title = (parsed.data.title || extracted.title || fallbackTitle).slice(0, 200).trim();
  if (!title) throw new Error("无法识别标题，请手工填写");
  const source = parsed.data.sourceType === "FILE" ? `文件：${fileName}` : sourceUri!;
  return {
    title,
    category: parsed.data.category,
    content,
    source: source.slice(0, 200),
    sourceType: parsed.data.sourceType,
    sourceUri,
    sourceHash: createHash("sha256").update(buffer).digest("hex"),
    mimeType,
    fileName,
    fileSize: buffer.byteLength,
    status: parsed.data.status,
  };
}
