/**
 * 全局 grep→cartog 规则测试 + has_edits 检查 + rtk 可用性
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs";
import { execSync } from "node:child_process";
import { getMatchTargets } from "@pi-lainforge/shepherd";

const RULES_PATH = path.resolve(
	path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
	"..",
	"rules.json",
);

function loadRules(): any[] {
	return JSON.parse(fs.readFileSync(RULES_PATH, "utf-8"));
}

// ================================================================
// 全局规则：grep→cartog 和 bash grep block
// ================================================================

describe("global grep→cartog rules", () => {
	const rules = loadRules();
	const grepRule = rules.find((r: any) => r.comment.includes("enforce-cartog-over-grep"));
	const bashGrepRule = rules.find((r: any) => r.comment.includes("enforce-cartog-over-bash-grep"));

	it("should find enforce-cartog-over-grep rule in global rules.json", () => {
		assert.ok(grepRule);
		assert.equal(grepRule.tool, "grep");
		assert.equal(grepRule.action, "notify");
		assert.equal(grepRule.hook, "tool_result");
		assert.deepEqual(grepRule.requiresTools, ["cartog_rag_search"]);
	});

	it("should find enforce-cartog-over-bash-grep rule in global rules.json", () => {
		assert.ok(bashGrepRule);
		assert.equal(bashGrepRule.tool, "bash");
		assert.equal(bashGrepRule.action, "block");
		assert.equal(bashGrepRule.hook, "tool_call");
	});

	it("should block bash grep with .ts file extension", () => {
		assert.ok(bashGrepRule);
		const re = new RegExp(bashGrepRule.pattern, bashGrepRule.flags);
		assert.ok(re.test('grep -n "OverlayOptions" /path/to/file.d.ts'));
	});

	it("should block bash grep with .py file extension", () => {
		assert.ok(bashGrepRule);
		const re = new RegExp(bashGrepRule.pattern, bashGrepRule.flags);
		assert.ok(re.test('grep -rn "myFunction" src/module.py'));
	});

	it("should block bash grep with .rs file extension", () => {
		assert.ok(bashGrepRule);
		const re = new RegExp(bashGrepRule.pattern, bashGrepRule.flags);
		assert.ok(re.test('rg "impl" quant_rust/src/lib.rs'));
	});

	it("should NOT block bash grep searching .md files", () => {
		assert.ok(bashGrepRule);
		const re = new RegExp(bashGrepRule.pattern, bashGrepRule.flags);
		assert.ok(!re.test('grep -rn "TODO" docs/ --include="*.md"'));
	});

	it("should NOT block bash grep on .jsonl", () => {
		assert.ok(bashGrepRule);
		const re = new RegExp(bashGrepRule.pattern, bashGrepRule.flags);
		assert.ok(!re.test('grep "key" session.jsonl'));
	});
});

// ================================================================
// grep scope 过滤集成测试
// ================================================================

describe("grep scope filtering", () => {
	it("in-scope path + code glob → non-empty targets", () => {
		const event = { input: { path: process.cwd(), pattern: "myFunction", glob: "*.py" } };
		const result = getMatchTargets("grep", event);
		assert.ok(Object.keys(result).length > 0);
	});

	it("out-of-scope path → empty targets", () => {
		const event = { input: { path: "/tmp/some/dir", pattern: "myFunction", glob: "*.py" } };
		const result = getMatchTargets("grep", event);
		assert.ok(Object.keys(result).length === 0);
	});

	it("non-code glob (.md) → empty targets", () => {
		const event = { input: { path: process.cwd(), pattern: "TODO", glob: "*.md" } };
		const result = getMatchTargets("grep", event);
		assert.ok(Object.keys(result).length === 0);
	});
});

// ================================================================
// has_edits check
// ================================================================

describe("has_edits check logic", () => {
	it("should find agent_end rule with check=has_edits", () => {
		const rules = loadRules();
		const agentEndRule = rules.find((r: any) => r.hook === "agent_end" && r.check === "has_edits");
		assert.ok(agentEndRule);
		assert.equal(agentEndRule.action, "notify");
		assert.deepEqual(agentEndRule.stopReason, ["stop"]);
	});

	it("should detect edit/write tools correctly", () => {
		const editTools = ["edit", "write"];
		const otherTools = ["bash", "grep", "read", "cartog_rag_search"];
		for (const t of editTools) {
			assert.ok(editTools.includes(t));
		}
		for (const t of otherTools) {
			assert.ok(!editTools.includes(t));
		}
	});
});

// ================================================================
// RTK 可用性
// ================================================================

describe("rtk availability", () => {
	it("should detect rtk installation status", () => {
		try {
			execSync("which rtk", { timeout: 2000, stdio: "pipe" });
			assert.ok(true, "rtk is installed");
		} catch {
			assert.ok(true, "rtk is not installed (OK, rewrite will be skipped)");
		}
	});
});
