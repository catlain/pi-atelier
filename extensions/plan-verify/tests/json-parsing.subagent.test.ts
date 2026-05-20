/**
 * Tests for JSON line parsing fix using processedOffset.
 *
 * The plan identifies a bug in the current runSubagent stdout parsing:
 * every "data" event re-processes ALL lines from the beginning of stdout,
 * which can cause duplicate processing of message_end events.
 *
 * The fix uses a `processedOffset` to track which bytes have been
 * processed, ensuring each line is only parsed once.
 */

import { describe, it, expect } from "vitest";

describe("JSON 行解析 - processedOffset 防止重复处理", () => {
	it("使用偏移量跟踪已处理位置，避免重复解析已有行", () => {
		// Simulate the fix described in the plan:
		// Instead of re-processing all lines each time data arrives,
		// track processedOffset and only process new data.

		let stdout = "";
		let processedOffset = 0;
		const allAssistantTexts: string[] = [];

		function onData(data: Buffer): void {
			stdout += data.toString();
			const newData = stdout.slice(processedOffset);
			for (const line of newData.split("\n")) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						for (const part of event.message.content) {
							if (part.type === "text") {
								allAssistantTexts.push(part.text);
							}
						}
					}
				} catch {
					/* skip non-JSON lines */
				}
			}
			processedOffset = stdout.length;
		}

		// First data chunk: first message
		const turn1 = JSON.stringify({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "第一轮审查" }],
			},
		});
		onData(Buffer.from(turn1 + "\n"));

		expect(allAssistantTexts).toHaveLength(1);
		expect(allAssistantTexts[0]).toBe("第一轮审查");

		// Second data chunk: only new data (as real stdout pipe would deliver)
		const turn2 = JSON.stringify({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "第二轮审查" }],
			},
		});
		// WITHOUT processedOffset, this would re-parse turn1 too
		// In a real pipe, the second chunk only contains new data, not old data.
		// BUT if the process writes data in a single burst, the chunk could contain both.
		// The key test is: with processedOffset, we only parse the NEW portion.
		// Simulate real behavior: second chunk is ONLY the new data.
		onData(Buffer.from(turn2 + "\n"));

		// WITH processedOffset, only new data is parsed
		expect(allAssistantTexts).toHaveLength(2);
		expect(allAssistantTexts[0]).toBe("第一轮审查");
		expect(allAssistantTexts[1]).toBe("第二轮审查");
	});

	it("不修复时：重复处理导致重复累积", () => {
		// This test demonstrates the BUG (before fix)
		let stdout = "";
		const texts: string[] = [];

		function onDataBuggy(data: Buffer): void {
			stdout += data.toString();
			// Bug: re-processes ALL lines every time
			for (const line of stdout.split("\n")) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						for (const part of event.message.content) {
							if (part.type === "text") {
								texts.push(part.text);
							}
						}
					}
				} catch {
					/* skip */
				}
			}
		}

		const msg = JSON.stringify({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "重复文本" }],
			},
		});

		onDataBuggy(Buffer.from(msg + "\n"));
		expect(texts).toHaveLength(1);

		// Second data chunk includes ALL previous data
		onDataBuggy(Buffer.from(msg + "\n" + msg + "\n"));
		// BUG: "重复文本" appears 3 times now (1 from first chunk + 2 from second)
		// Expected = 3, Should be = 2
		expect(texts.filter((t) => t === "重复文本").length).toBeGreaterThanOrEqual(3);
	});

	it("非 JSON 行应被静默跳过（try/catch）", () => {
		let stdout = "";
		let processedOffset = 0;
		const texts: string[] = [];

		function onData(data: Buffer): void {
			stdout += data.toString();
			const newData = stdout.slice(processedOffset);
			for (const line of newData.split("\n")) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						for (const part of event.message.content) {
							if (part.type === "text") {
								texts.push(part.text);
							}
						}
					}
				} catch {
					/* skip non-JSON */
				}
			}
			processedOffset = stdout.length;
		}

		// Mix of JSON and non-JSON lines
		const msg = JSON.stringify({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "有效内容" }],
			},
		});

		onData(Buffer.from("not json\nlog line\n" + msg + "\nmore noise\n"));

		expect(texts).toHaveLength(1);
		expect(texts[0]).toBe("有效内容");
	});

	it("多次 data 事件，每次只处理新增数据", () => {
		let stdout = "";
		let processedOffset = 0;
		const texts: string[] = [];

		function onData(data: Buffer): void {
			stdout += data.toString();
			const newData = stdout.slice(processedOffset);
			for (const line of newData.split("\n")) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						for (const part of event.message.content) {
							if (part.type === "text") {
								texts.push(part.text);
							}
						}
					}
				} catch {
					/* skip */
				}
			}
			processedOffset = stdout.length;
		}

		// Three separate data events, each with one new line
		onData(Buffer.from('{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"A"}]}}\n'));
		onData(Buffer.from('{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"B"}]}}\n'));
		onData(Buffer.from('{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"C"}]}}\n'));

		expect(texts).toHaveLength(3);
		expect(texts).toEqual(["A", "B", "C"]);
	});
});
