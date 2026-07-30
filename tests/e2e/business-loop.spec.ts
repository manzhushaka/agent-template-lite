import { expect, test } from "@playwright/test";

test("Chat completes product card and confirmed order loop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AgentOS 已连接")).toBeVisible();
  await page.locator(".starter-prompts").getByRole("button", { name: /预算选品/ }).click();
  await expect(page.getByRole("heading", { name: "山野茶礼盒" })).toBeVisible();
  await page.getByRole("button", { name: "选择商品" }).click();
  await expect(page.getByRole("heading", { name: "确认创建演示订单" })).toBeVisible();
  await page.getByRole("button", { name: "确认执行" }).click();
  await expect(page.getByRole("heading", { name: "订单 D-E2E" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
