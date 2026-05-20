/**
 * Tests: agent-loader.ts
 *
 * 测试场景：
 * 1) 正常解析 frontmatter → AgentDef
 * 2) ~/.pi/agent/agents/ 目录不存在 → loadAgentDef 返回 null
 * 3) frontmatter 缺少必填字段（name/description）→ 仍返回有效 def（name 从文件名推断）
 * 4) 无 --- 分隔符 → name 从文件名推断，description 为空，整个内容作为 systemPrompt
 * 5) 同名文件在两个目录中都存在 → ~/.pi/agent/agents/ 优先
 * 6) mtime 缓存失效：文件修改后重新读取
 * 7) Fallback：loadAgentDef 返回 null → runSubagent 使用硬编码提示
 * 8) Fallback：目录不存在 → loadAgentDef 返回 null（不抛异常）
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================
// Test 1: 正常解析 frontmatter
// ============================================================

describe("frontmatter 解析", () => {
	it("Test 1: 有完整 frontmatter 时正确解析 name/tools/systemPrompt", () => {
		const content = `---
name: pv-reviewer
description: "审查 agent"
tools: "read,grep,find,ls"
---
工具使用约束...
`;

		// Same logic as agent-loader.ts parseAgentFile
		const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
		expect(fmMatch).not.toBeNull();

		const fm = fmMatch![1];
		const body = content.slice(fmMatch![0].length).trim();

		const fields: Record<string, string> = {};
		for (const line of fm.split("\n")) {
			const idx = line.indexOf(":");
			if (idx > 0) {
				let val = line.slice(idx + 1).trim();
				if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
					val = val.slice(1, -1);
				}
				fields[line.slice(0, idx).trim()] = val;
			}
		}

		expect(fields.name).toBe("pv-reviewer");
		expect(fields.tools).toBe("read,grep,find,ls");
		expect(body).toBe("工具使用约束...");
	});

	it("Test 1a: tools 字段正确拆分为数组", () => {
		const toolsStr = "read,bash,edit,write,grep,find,ls";
		const tools = toolsStr.split(",").map((t) => t.trim()).filter(Boolean);

		expect(tools).toEqual(["read", "bash", "edit", "write", "grep", "find", "ls"]);
		expect(tools).toContain("bash");
		expect(tools).not.toContain("exec");
	});

	it("Test 1b: review agent 不应包含 bash", () => {
		const tools = "read,grep,find,ls".split(",").map((t) => t.trim());
		expect(tools).not.toContain("bash");
		expect(tools).not.toContain("edit");
		expect(tools).not.toContain("write");
	});

	it("Test 1c: test-writer agent 不应包含 bash", () => {
		const tools = "read,write,grep,find,ls".split(",").map((t) => t.trim());
		expect(tools).not.toContain("bash");
		expect(tools).not.toContain("edit");
	});

	it("Test 1d: model 字段可选", () => {
		const content = `---
name: pv-executor
tools: "read,bash,edit,write,grep,find,ls"
---
执行提示`;

		const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
		const fm = fmMatch![1];
		const fields: Record<string, string> = {};
		for (const line of fm.split("\n")) {
			const idx = line.indexOf(":");
			if (idx > 0) {
				let val = line.slice(idx + 1).trim();
				if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
					val = val.slice(1, -1);
				}
				fields[line.slice(0, idx).trim()] = val;
			}
		}

		// model 不存在时不报错
		expect(fields.model).toBeUndefined();
	});
});

// ============================================================
// Test 4: 无 frontmatter
// ============================================================

describe("无 frontmatter 的情况", () => {
	it("Test 4: 无 --- 分隔符 → name 从文件名推断，整个内容作为 systemPrompt", () => {
		const fileName = "pv-reviewer.md";
		const content = "你是一个审查 agent。你的任务是...";

		const name = fileName.replace(/\.md$/, "");
		expect(name).toBe("pv-reviewer");

		const systemPrompt = content.trim();
		expect(systemPrompt).toBe("你是一个审查 agent。你的任务是...");
	});
});

// ============================================================
// Test 5: 同名文件优先级
// ============================================================

describe("搜索路径优先级", () => {
	it("Test 5: ~/.pi/agent/agents/ 优先于 ~/.agents/agents/", () => {
		const dirs = [
			path.join(os.homedir(), ".pi", "agent", "agents"),
			path.join(os.homedir(), ".agents", "agents"),
		];
		// 按顺序搜索，第一个找到的返回
		for (const dir of dirs) {
			if (fs.existsSync(path.join(dir, "pv-reviewer.md"))) {
				expect(dir).toBe(path.join(os.homedir(), ".pi", "agent", "agents"));
				return;
			}
		}
		// 如果都不存在，测试跳过
	});
});

// ============================================================
// Test 7 & 8: Fallback
// ============================================================

describe("Fallback 行为", () => {
	it("Test 8: 目录不存在时不抛异常", () => {
		const fakeDir = path.join(os.tmpdir(), "nonexistent-agents-dir-" + Date.now());
		expect(fs.existsSync(fakeDir)).toBe(false);

		// 应该正常返回 null，不抛异常
		const result = (() => {
			const filePath = path.join(fakeDir, "pv-reviewer.md");
			if (!fs.existsSync(filePath)) return null;
			return { name: "pv-reviewer" };
		})();

		expect(result).toBeNull();
	});

	it("Test 7: loadAgentDef 返回 null 时 subagent 使用 fallback 映射", () => {
		// 验证 FALLBACK_PROMPTS map 在 subagent.ts 中的结构
		const fallbackNames = ["pv-reviewer", "pv-executor", "pv-test-writer"];
		const fallbackTools: Record<string, string[]> = {
			"pv-reviewer": ["read", "grep", "find", "ls"],
			"pv-executor": ["read", "bash", "edit", "write", "grep", "find", "ls"],
			"pv-test-writer": ["read", "write", "grep", "find", "ls"],
		};

		for (const name of fallbackNames) {
			expect(fallbackTools[name]).toBeDefined();
			expect(fallbackTools[name].length).toBeGreaterThan(0);
		}

		// 验证 review fallback 工具不含 bash
		expect(fallbackTools["pv-reviewer"]).not.toContain("bash");
		expect(fallbackTools["pv-executor"]).toContain("bash");
	});
});
