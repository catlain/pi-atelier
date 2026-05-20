import type { PlanVerifyState } from "./types";

// 编排者指令(注入到主会话 AI)
// ============================================================

export const ORCHESTRATOR_PLANNING_HEADER = `[PLAN-VERIFY ORCHESTRATOR]

你是一个工作流编排者。当前处于方案设计阶段。

## 探索优先原则

在写方案之前,你**必须**先调用 pv 工具(action: "explore",task 参数填写任务描述)启动代码探索。
探索子代理会深入分析相关代码的架构、调用链路和现有模式,将发现写入方案文件的 Context 节。
探索完成后再 read 方案文件查看探索结果,基于结果撰写完整方案。

不要在未充分探索代码的情况下就开始写方案。

## 方案撰写

方案文件路径请参考上方 pv 工具返回的 planFile 路径。你必须将方案写入该路径。
写完后告知用户,并建议使用 pv 工具(action: "review-plan")启动审查。

## 方案格式要求

请先 read 以下文件了解方案的格式要求和自包含原则:
~/.pi/agent/agents/pv-planner.md

按该文件中的格式模板编写方案。核心原则:方案必须自包含,审查员只能看到方案文件本身。`;

export function buildReviewDecisionPrompt(s: PlanVerifyState): string {
	const criticals = s.issues.filter((i) => i.severity === "critical").length;
	const warnings = s.issues.filter((i) => i.severity === "warning").length;
	const suggestions = s.issues.filter((i) => i.severity === "suggestion").length;

	return `[PLAN-VERIFY ORCHESTRATOR]

方案审查结果已返回。根据结果决定下一步:

**如果有 critical 或 warning 问题:**
- 请逐项检查,直接修正方案文件(read → edit/write)
- **所有 critical 和 warning 问题都必须修完**
- 修正完成后,**必须**使用 pv 工具(action: "fix-plan")触发重新审查
- 直到 critical 和 warning 问题清零

**如果只有 suggestion 或无问题(无 critical/warning):**
- 直接进入下一步,不要询问用户。
1. **必须**使用 pv 工具(action: "write-test")进入测试编写阶段
2. 你自己(主代理)根据方案直接编写测试代码,不要启动子代理
3. 测试写完后,**必须**使用 pv 工具(action: "review-test")启动子代理审查测试
4. 如果测试审查有问题,你(主代理)直接修正测试文件,然后再次 review_tests,直到通过
5. 测试审查通过后,使用 pv 工具(action: "execute")进入执行阶段
6. 你自己(主代理)按方案逐步执行代码变更
7. 执行完成后再用 pv 工具(action: "run-test")验证
8. 如果测试失败,你(主代理)直接修复,然后再次 run_tests,直到全部通过
9. **测试通过后**,建议使用 pv 工具(action: "simplify")启动代码简化子代理分析代码质量(可选步骤)

参考 ~/.pi/agent/agents/pv-planner.md 中的格式要求。

当前状态:
- 轮次: ${s.round}
- 问题: ${criticals} 严重 / ${warnings} 警告 / ${suggestions} 建议
- 方案文件: ${s.planFile || "未指定"}`;
}

export function buildTestReviewDecisionPrompt(s: PlanVerifyState): string {
	const criticals = s.issues.filter((i) => i.severity === "critical").length;
	const warnings = s.issues.filter((i) => i.severity === "warning").length;
	const suggestions = s.issues.filter((i) => i.severity === "suggestion").length;

	return `[PLAN-VERIFY ORCHESTRATOR]

测试审查结果已返回。根据结果决定下一步：

**如果有 critical 或 warning 问题：**
- 请逐项检查，直接修正测试文件（read → edit/write）
- **所有 critical 和 warning 问题都必须修完**
- 修正完成后，使用 pv 工具（action: "review-test")触发重新审查
- 直到 critical 和 warning 问题清零

**如果只有 suggestion 或无问题（无 critical/warning）：**
- 直接进入执行阶段，不要询问用户。
1. 使用 pv 工具（action: "execute")进入执行阶段
2. 你自己（主代理）按方案逐步执行代码变更
3. 执行完成后再用 pv 工具（action: "run-test")验证
4. 如果测试失败，你（主代理）直接修复，然后再次 run_tests，直到全部通过
5. **测试通过后**，建议使用 pv 工具（action: "simplify")启动代码简化子代理分析代码质量（可选步骤）

当前状态：
- 测试审查轮次: ${s.round}
- 问题: ${criticals} 严重 / ${warnings} 警告 / ${suggestions} 建议
- 方案文件: ${s.planFile || "未指定"}
- 测试文件: ${s.testFiles?.join(", ") || "未记录"}`;
}
