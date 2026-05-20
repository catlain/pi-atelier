/**
 * Pi Notification Sound Extension
 *
 * 在 AI 完成回复（agent_end）时播放提示音 + 发送终端通知。
 * 类似 Claude Code hooks 中的 session_end.js 功能。
 *
 * 支持平台:
 * - Windows: powershell 播放系统音效 + Toast 通知
 * - macOS: afplay 播放音效 + osascript 通知
 * - Linux: paplay / aplay 播放音效 + notify-send 通知
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// ── 配置 ────────────────────────────────────────────────
// 可根据喜好修改：
const ENABLE_SOUND = true;        // 是否播放声音
const ENABLE_NOTIFICATION = true; // 是否发送系统通知
const NOTIFICATION_TITLE = "Pi";
const NOTIFICATION_BODY = "AI 已完成回复，等待你的输入";

// Windows 系统音效路径（可换成你喜欢的 .wav 文件）
const WINDOWS_SOUND_PATH = "C:\\Windows\\Media\\chimes.wav";
// macOS 内置音效
const MACOS_SOUND_PATH = "/System/Library/Sounds/Glass.aiff";
// ────────────────────────────────────────────────────────

function playSoundWindows() {
	execFile("powershell.exe", [
		"-NoProfile", "-NonInteractive",
		"-Command", "[console]::beep(1000,500)",
	], (err) => {
		if (err) console.error("[notification-sound] 播放音效失败:", err.message);
	});
}

function playSoundMac() {
	if (!existsSync(MACOS_SOUND_PATH)) return;
	execFile("afplay", [MACOS_SOUND_PATH], (err) => {
		if (err) console.error("[notification-sound] 播放音效失败:", err.message);
	});
}

function playSoundLinux() {
	// WSL2: 优先用 powershell.exe 播放 Windows 系统音效
	if (existsSync("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe")) {
		playSoundWindows();
		return;
	}
	// 原生 Linux: paplay (PulseAudio) → aplay (ALSA)
	const cmd = existsSync("/usr/bin/paplay") ? "paplay" : "aplay";
	const soundFile = "/usr/share/sounds/freedesktop/stereo/bell.oga";
	const args = cmd === "paplay" ? [soundFile] : ["/usr/share/sounds/alsa/Front_Center.wav"];
	execFile(cmd, args, (err) => {
		if (err) console.error("[notification-sound] 播放音效失败:", err.message);
	});
}

function playSound() {
	if (!ENABLE_SOUND) return;
	if (process.platform === "win32") {
		playSoundWindows();
	} else if (process.platform === "darwin") {
		playSoundMac();
	} else {
		playSoundLinux();
	}
}

// ── 系统通知 ─────────────────────────────────────────────

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
	process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notifyWindows(title: string, body: string): void {
	execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)]);
}

function notifyMac(title: string, body: string): void {
	execFile("osascript", ["-e", `display notification "${body}" with title "${title}"`]);
}

function notifyLinux(title: string, body: string): void {
	execFile("notify-send", [title, body]);
}

function sendNotification() {
	if (!ENABLE_NOTIFICATION) return;
	if (process.platform === "win32") {
		if (process.env.WT_SESSION) {
			notifyWindows(NOTIFICATION_TITLE, NOTIFICATION_BODY);
		} else {
			notifyOSC777(NOTIFICATION_TITLE, NOTIFICATION_BODY);
		}
	} else if (process.platform === "darwin") {
		notifyMac(NOTIFICATION_TITLE, NOTIFICATION_BODY);
	} else {
		// WSL2: 通过 powershell.exe 发 Toast 通知
		if (existsSync("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe")) {
			notifyWindows(NOTIFICATION_TITLE, NOTIFICATION_BODY);
		} else {
			notifyLinux(NOTIFICATION_TITLE, NOTIFICATION_BODY);
		}
	}
}

// ── 扩展入口 ─────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		// 只在交互式会话中提示（子代理用 --mode json -p 运行，hasUI 为 false）
		if (!ctx.hasUI) return;
		playSound();
		sendNotification();
	});
}
