import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseKnowledgeImport } from "./knowledge-import";

describe("knowledge import", () => {
  it("extracts HTML files and records source metadata", async () => {
    const html = "<html><head><title>服务规则</title><style>hidden</style></head><body><main><h1>办理说明</h1><p>这是用于验证知识导入流程的正文内容。</p></main></body></html>";
    const form = new FormData();
    form.set("category", "业务规则");
    form.set("status", "PUBLISHED");
    form.set("sourceType", "FILE");
    form.set("file", new File([html], "rules.html", { type: "text/html" }));

    const result = await parseKnowledgeImport(form);
    expect(result.title).toBe("服务规则");
    expect(result.content).toContain("办理说明");
    expect(result.content).not.toContain("hidden");
    expect(result.sourceHash).toBe(createHash("sha256").update(html).digest("hex"));
    expect(result.sourceType).toBe("FILE");
  });

  it("rejects unsupported files", async () => {
    const form = new FormData();
    form.set("category", "业务规则");
    form.set("status", "DRAFT");
    form.set("sourceType", "FILE");
    form.set("file", new File(["binary"], "image.png", { type: "image/png" }));
    await expect(parseKnowledgeImport(form)).rejects.toThrow("仅支持 PDF、HTML、Markdown 和纯文本文件");
  });
});
