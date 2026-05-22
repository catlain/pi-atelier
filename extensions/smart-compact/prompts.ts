/**
 * LLM prompt 模板
 */

export const SEGMENT_SYSTEM_PROMPT = `You are analyzing a conversation segment to determine its relevance to the current task and generate a concise summary.
Always respond with valid JSON only, no markdown formatting.`;

export const SEGMENT_USER_PROMPT = `<current-task>
The user is currently working on: {currentTask}
</current-task>

<conversation-segment>
{segment}
</conversation-segment>

Analyze this conversation segment and determine its relevance to the current task described above.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "relevant": true or false,
  "topics": ["topic1", "topic2"],
  "summary": "Concise summary preserving key decisions, file paths, function names, error messages"
}

Rules:
- Mark as relevant if the segment contains: decisions affecting current work, file paths/functions referenced later, error context needed for understanding, or background context for the current task
- Mark as irrelevant if the segment is about: completed unrelated tasks, abandoned approaches, or idle chitchat
- When in doubt, mark as relevant (prefer over-inclusion over loss of context)
- Summary should be 2-5 sentences maximum
- Preserve exact file paths, function names, and error messages`;

export const MERGE_SYSTEM_PROMPT = `You are creating a structured context checkpoint summary for an AI coding agent.
The summary will be used by another LLM to continue the user's work.
Preserve all critical technical details: file paths, function names, error messages, and key decisions.`;

export const MERGE_USER_PROMPT = `<current-task>
{currentTask}
</current-task>

{previousSummarySection}
<segment-summaries>
{segmentSummaries}
</segment-summaries>
{turnPrefixSection}

Create a structured context checkpoint summary using this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

export const EXTRACT_TASK_PROMPT = `Extract a brief description (1-3 sentences) of what the user is currently working on based on the most recent messages.
Focus on the latest active task. If there are multiple tasks, mention the primary one.
Output ONLY the task description, no formatting.`;

/** 分段摘要 system prompt 别名 */
export const SEGMENT_SUMMARY_SYSTEM = SEGMENT_SYSTEM_PROMPT;

/** 构建分段摘要的 user prompt */
export function buildSegmentPrompt(segmentText: string, currentTask: string): string {
	return SEGMENT_USER_PROMPT
		.replace('{currentTask}', currentTask)
		.replace('{segment}', segmentText);
}

/** 构建合并摘要的 system prompt */
export const MERGE_SUMMARY_SYSTEM = MERGE_SYSTEM_PROMPT;

/** 构建合并摘要的 user prompt */
export function buildMergePrompt(
	segments: Array<{ topics: string[]; summary: string }>,
	previousSummary?: string,
	turnPrefix?: string,
): string {
	const previousSummarySection = previousSummary
		? `<previous-summary>\n${previousSummary}\n</previous-summary>`
		: "";
	const turnPrefixSection = turnPrefix
		? `<split-turn-context>\n${turnPrefix}\n</split-turn-context>`
		: "";

	const segmentSummaries = segments
		.map((s, i) => `### 段 ${i + 1}: ${s.topics.join(", ")}\n${s.summary}`)
		.join("\n\n");

	return MERGE_USER_PROMPT
		.replace("{currentTask}", "(merged from segments)")
		.replace("{previousSummarySection}", previousSummarySection)
		.replace("{segmentSummaries}", segmentSummaries)
		.replace("{turnPrefixSection}", turnPrefixSection);
}
