/**
 * Tests: Agent .md 文件存在性与 frontmatter 字段完整性
 *
 * 验证 3 个 agent .md 文件：
 *   - ~/.pi/agent/agents/pv-reviewer.md
 *   - ~/.pi/agent/agents/pv-executor.md
 *   - ~/.pi/agent/agents/pv-test-writer.md
 *
 * 每个文件必须有完整的 frontmatter（name/description/tools 字段）
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const AGENTS_DIR = path.join(os.homedir(), ".pi", "agent", "agents");
const AGENT_FILES = ["pv-reviewer.md", "pv-executor.md", "pv-test-writer.md"];

/** 解析 frontmatter，返回字段字典 */
function parseFrontmatter(content: string): Record<string, string> {
	const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
	if (!fmMatch) return {};

	const fm = fmMatch[1];
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
	return fields;
}

describe("Agent .md 文件", () => {
	beforeAll(() => {
		expect(fs.existsSync(AGENTS_DIR)).toBe(true);
	});

	for (const fileName of AGENT_FILES) {
		describe(fileName, () => {
			const filePath = path.join(AGENTS_DIR, fileName);
			let content: string;
			let fm: Record<string, string>;

			beforeAll(() => {
				expect(fs.existsSync(filePath), `${filePath} 应该存在`).toBe(true);
				content = fs.readFileSync(filePath, "utf-8");
				fm = parseFrontmatter(content);
			});

			it("应该有 frontmatter（--- 分隔符）", () => {
				expect(content.startsWith("---")).toBe(true);
			});

			it("应包含 name 字段", () => {
				expect(fm.name).toBeDefined();
				expect(fm.name.length).toBeGreaterThan(0);
			});

			it("应包含 description 字段", () => {
				expect(fm.description).toBeDefined();
				expect(fm.description.length).toBeGreaterThan(0);
			});

			it("应包含 tools 字段", () => {
				expect(fm.tools).toBeDefined();
				expect(fm.tools.length).toBeGreaterThan(0);
			});

			it("tools 应为逗号分隔的字符串", () => {
				const tools = fm.tools?.split(",").map((t) => t.trim()).filter(Boolean) || [];
				expect(tools.length).toBeGreaterThan(0);
			});

			it("frontmatter 后应有系统提示正文", () => {
				const afterFm = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "").trim();
				expect(afterFm.length).toBeGreaterThan(100);
			});
		});
	}
});
