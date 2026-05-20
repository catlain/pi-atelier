/**
 * Guard line-count — 文件行数检查 — 单元测试
 *
 * 测试场景：
 * 1) 代码文件阈值：WARN(200) / MUST(300) / BAN(500)
 * 2) 记忆文件阈值：80 行
 * 3) 非检查扩展名跳过
 * 4) 文件不存在不抛异常
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// 由于 checkLineCount 通过 pushWarning 触发副作用，
// 我们通过监视 pushWarning 的调用来验证行为
import * as ephemeral from "@pi-lainforge/shepherd";

// Mock ephemeral.pushWarning
import { vi } from "vitest";

// ── 测试辅助 ──────────────────────────────────────────────

const tmpDir = path.join(os.tmpdir(), `shepherd-line-count-test-${Date.now()}`);

function createTempFile(relativePath: string, lines: number): string {
  const filePath = path.join(tmpDir, relativePath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const content = Array.from({ length: lines }, (_, i) => `line ${i}`).join("\n");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function cleanup() {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// 由于 checkLineCount 直接 import pushWarning，我们需要重新导入被测试模块
// 但 vi.mock 可能在模块导入之前就需要设置
// 我们通过 spyOn pushWarning 来检测调用

describe("checkLineCount", () => {
  let pushWarningSpy: any;

  beforeEach(() => {
    cleanup();
    fs.mkdirSync(tmpDir, { recursive: true });
    // 清空 ephemeral 缓冲区
    // drainHints from ephemeral-shared
  });

  afterEach(() => {
    cleanup();
  });

  // ── 代码文件行数检查 ────────────────────────────────────

  it("200 行以下不触发警告（无 pushWarning）", async () => {
    // 需要动态 import 模块来获取未被 mock 的函数
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("small.ts", 50);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).not.toHaveBeenCalled();
    pushWarningSpy.mockRestore();
  });

  it("200-300 行触发 WARN 级别警告", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("moderate.ts", 250);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("⚠️");
    expect(msg).toContain("250 行");
    pushWarningSpy.mockRestore();
  });

  it("300-500 行触发 MUST 级别警告（必须拆分）", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("large.py", 350);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("🔴");
    expect(msg).toContain("350 行");
    expect(msg).toContain("必须拆分");
    pushWarningSpy.mockRestore();
  });

  it("超过 500 行触发 BAN 级别警告（严禁）", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("huge.rs", 600);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("❌");
    expect(msg).toContain("600 行");
    expect(msg).toContain("严禁");
    pushWarningSpy.mockRestore();
  });

  it("恰好 200 行应触发警告（≥200 是 WARN 阈值）", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("exact200.ts", 200);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    pushWarningSpy.mockRestore();
  });

  // ── 记忆文件行数检查 ────────────────────────────────────

  it("记忆文件超过 80 行触发拆分提醒", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("memory/test_topic.md", 100);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("📝");
    expect(msg).toContain("100 行");
    expect(msg).toContain("必须拆分");
    pushWarningSpy.mockRestore();
  });

  it("记忆文件 80 行以下不触发警告", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("memory/small_topic.md", 50);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).not.toHaveBeenCalled();
    pushWarningSpy.mockRestore();
  });

  // ── 非检查扩展名 ────────────────────────────────────────

  it("非检查扩展名不触发警告", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("data.json", 1000);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).not.toHaveBeenCalled();
    pushWarningSpy.mockRestore();
  });

  it("未识别的扩展名不触发警告", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("doc.docx", 5000);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).not.toHaveBeenCalled();
    pushWarningSpy.mockRestore();
  });

  // ── 文件不存在 ──────────────────────────────────────────

  it("文件不存在时不抛异常", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    // 不存在的文件
    lineCount.checkLineCount(path.join(tmpDir, "nonexistent.ts"));

    expect(pushWarningSpy).not.toHaveBeenCalled();
    pushWarningSpy.mockRestore();
  });

  // ── 边界值 ──────────────────────────────────────────────

  it("正好 500 行触发 BAN", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("boundary500.ts", 500);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("❌");
    pushWarningSpy.mockRestore();
  });

  it("正好 300 行触发 MUST", async () => {
    const lineCount = await import("@pi-lainforge/shepherd");
    pushWarningSpy = vi.spyOn(ephemeral, "pushWarning");

    const filePath = createTempFile("boundary300.ts", 300);
    lineCount.checkLineCount(filePath);

    expect(pushWarningSpy).toHaveBeenCalledTimes(1);
    const msg = pushWarningSpy.mock.calls[0][0];
    expect(msg).toContain("🔴");
    pushWarningSpy.mockRestore();
  });
});
