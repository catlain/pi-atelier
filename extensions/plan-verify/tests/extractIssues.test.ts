/**
 * Tests for extractIssues — 结构化 JSON 问题提取
 *
 * 测试真实的 extractIssues 函数（从 utils.ts import），
 * 验证 JSON 块解析、边界处理和 parseError 标记。
 */

import { describe, it, expect } from "vitest";

// 直接 import 真实函数
import { extractIssues, ISSUES_JSON_CONSTRAINT } from "../utils";

describe("extractIssues - 结构化 JSON 问题提取", () => {
	it("应从 JSON 块提取 critical 问题", () => {
		const text = `## 发现的问题

**[Critical]** 缺少错误处理

<!-- ISSUES_JSON
[{"severity":"critical","description":"缺少错误处理","suggestion":"添加 try/catch"}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(1);
		expect(issues[0].severity).toBe("critical");
		expect(issues[0].description).toBe("缺少错误处理");
		expect(issues[0].suggestion).toBe("添加 try/catch");
	});

	it("应提取多级别问题", () => {
		const text = `## 发现的问题

<!-- ISSUES_JSON
[{"severity":"critical","description":"方案步骤与目标脱节"},{"severity":"warning","description":"错误处理不完整"},{"severity":"suggestion","description":"命名可以更清晰"}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(3);
		expect(issues[0].severity).toBe("critical");
		expect(issues[1].severity).toBe("warning");
		expect(issues[2].severity).toBe("suggestion");
	});

	it("空数组返回无问题", () => {
		const text = `测试审查完成：所有测试通过。

<!-- ISSUES_JSON
[]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(0);
	});

	it("无 JSON 块返回 parseError", () => {
		const text = `## 汇总
- **[Critical]** 0 个
- **[Warning]** 2 个`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(true);
		expect(issues).toHaveLength(0);
	});

	it("JSON 格式错误返回 parseError", () => {
		const text = `<!-- ISSUES_JSON
[{severity:critical}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(true);
		expect(issues).toHaveLength(0);
	});

	it("过滤无效 severity", () => {
		const text = `<!-- ISSUES_JSON
[{"severity":"error","description":"某个问题描述"},{"severity":"warning","description":"一个有效的警告描述"}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(1);
		expect(issues[0].severity).toBe("warning");
	});

	it("过滤 description 不足 5 字符", () => {
		const text = `<!-- ISSUES_JSON
[{"severity":"critical","description":"短"},{"severity":"critical","description":"这个问题够长"}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(1);
		expect(issues[0].description).toBe("这个问题够长");
	});

	it("description 截断到 500 字符", () => {
		const longDesc = "a".repeat(1000);
		const text = `<!-- ISSUES_JSON
[{"severity":"critical","description":"${longDesc}"}]
-->`;
		const { issues } = extractIssues(text);
		expect(issues).toHaveLength(1);
		expect(issues[0].description.length).toBe(500);
	});

	it("不把汇总中的 [Critical] 0 个解析为 issue（根因回归）", () => {
		const text = `## 发现的问题

**[Warning]** fallback read 未完全验证

## 汇总
- **[Critical]** 0 个
- **[Warning]** 2 个

<!-- ISSUES_JSON
[{"severity":"warning","description":"fallback read 走 parquet 未完全验证"},{"severity":"warning","description":"两项测试被 skip"}]
-->`;
		const { issues, parseError } = extractIssues(text);
		expect(parseError).toBe(false);
		expect(issues).toHaveLength(2);
		const criticals = issues.filter(i => i.severity === "critical").length;
		expect(criticals).toBe(0);
	});
});

describe("ISSUES_JSON_CONSTRAINT - 输出格式约束", () => {
	it("合法输出通过验证", () => {
		const text = `审查结果

<!-- ISSUES_JSON
[{"severity":"warning","description":"某个问题需要修复"}]
-->`;
		expect(ISSUES_JSON_CONSTRAINT.validate(text)).toBeNull();
	});

	it("空数组通过验证", () => {
		const text = `<!-- ISSUES_JSON\n[]\n-->`;
		expect(ISSUES_JSON_CONSTRAINT.validate(text)).toBeNull();
	});

	it("缺少 JSON 块不通过", () => {
		const text = `没有 JSON 块`;
		const err = ISSUES_JSON_CONSTRAINT.validate(text);
		expect(err).toContain("缺少");
	});

	it("无效 severity 不通过", () => {
		const text = `<!-- ISSUES_JSON\n[{"severity":"error","description":"某个问题描述"}]\n-->`;
		const err = ISSUES_JSON_CONSTRAINT.validate(text);
		expect(err).toContain("无效 severity");
	});

	it("description 太短不通过", () => {
		const text = `<!-- ISSUES_JSON\n[{"severity":"critical","description":"短"}]\n-->`;
		const err = ISSUES_JSON_CONSTRAINT.validate(text);
		expect(err).toContain("5 字符");
	});

	it("JSON 格式错误不通过", () => {
		const text = `<!-- ISSUES_JSON\n{bad json}\n-->`;
		const err = ISSUES_JSON_CONSTRAINT.validate(text);
		expect(err).toContain("JSON 解析失败");
	});
});
