/**
 * Voice Input Core — 录音 + 识别逻辑
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, execFileSync } from "child_process";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const MODEL_DIR = join(
	homedir(), ".pi/models/voice",
	"sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17",
);
const MODEL_URL =
	"https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2";
const SR = 16000;
const MAX_SEC = 60;

let active = false;
let proc: ReturnType<typeof spawn> | null = null;
let wavFile = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let savedCtx: any = null;

function modelReady() { return existsSync(join(MODEL_DIR, "model.int8.onnx")); }

function notify(msg: string, level: "info" | "warning" | "error" = "info") {
	savedCtx?.ui?.notify?.(msg, level);
}

async function stopProc(): Promise<void> {
	active = false;
	if (timer) { clearTimeout(timer); timer = null; }
	if (!proc) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const p = proc!;
		const t = setTimeout(() => { p.kill("SIGKILL"); resolve(); }, 2000);
		p.on("exit", () => { clearTimeout(t); resolve(); });
		// parecord 需要 SIGINT 才能正确 flush WAV header
		p.kill("SIGINT");
		proc = null;
	});
}

async function download(): Promise<boolean> {
	const base = join(homedir(), ".pi/models/voice");
	mkdirSync(base, { recursive: true });
	const tmp = "/tmp/sherpa-onnx-sense-voice.tar.bz2";
	notify("⏳ 下载语音模型 (~230MB)...");
	return new Promise((resolve) => {
		const wget = spawn("wget", ["-q", "-O", tmp, MODEL_URL]);
		wget.on("exit", (code) => {
			if (code !== 0) { notify("❌ 模型下载失败", "error"); resolve(false); return; }
			const tar = spawn("tar", ["xf", tmp, "-C", base]);
			tar.on("exit", (tc) => {
				try { unlinkSync(tmp); } catch {}
				resolve(tc === 0 ? (notify("✅ 模型就绪"), true) : (notify("❌ 解压失败", "error"), false));
			});
		});
	});
}

function isWSL2(): boolean {
	try { return process.env.WSLENV !== undefined || existsSync("/mnt/wslg/PulseServer"); }
	catch { return false; }
}

function pulseServer(): string | null {
	const wslg = "/mnt/wslg/PulseServer";
	if (existsSync(wslg)) return wslg;
	const uid = process.getuid?.() ?? 1000;
	const user = `/run/user/${uid}/pulse/native`;
	return existsSync(user) ? user : null;
}

/** 录音启动 — 返回 true 表示成功且进程仍存活 */
async function startRec(): Promise<boolean> {
	wavFile = `/tmp/pi-voice-${Date.now()}.wav`;
	const env = { ...process.env } as Record<string, string>;
	let cmd = "";
	let args: string[] = [];

	const ps = pulseServer();
	if (ps) {
		try {
			execFileSync("which", ["parecord"], { stdio: "pipe" });
			env.PULSE_SERVER = ps;
			cmd = "parecord";
			// 必须传文件名，parecord 不支持 stdout 输出
			args = ["--device=RDPSource", "--file-format=wav", "--rate", String(SR), "--channels", "1", wavFile];
		} catch { /* fallthrough */ }
	}
	if (!cmd) {
		try {
			execFileSync("which", ["arecord"], { stdio: "pipe" });
			cmd = "arecord";
			args = ["-f", "S16_LE", "-r", String(SR), "-c", "1", wavFile];
		} catch { /* fallthrough */ }
	}
	if (!cmd) {
		try {
			execFileSync("which", ["ffmpeg"], { stdio: "pipe" });
			cmd = "ffmpeg";
			args = ["-y", "-loglevel", "quiet", "-f", "pulse", "-i", "default",
				"-ac", "1", "-ar", String(SR), wavFile];
		} catch {
			notify("❌ 需要 parecord/arecord/ffmpeg", "error");
			return false;
		}
	}

	// 注意：不做 pactl 预检 — PulseServer 可能卡住导致预检超时，
	// 但 parecord 自己启动后 500ms 内就能暴露真正问题

	// 最后尝试 ffmpeg
	if (!cmd) {
		try {
			execFileSync("which", ["ffmpeg"], { stdio: "pipe" });
			cmd = "ffmpeg";
			args = ["-y", "-loglevel", "quiet", "-f", "pulse", "-i", "default",
				"-ac", "1", "-ar", String(SR), wavFile];
		} catch {
			notify("❌ 未找到可用的录音工具 (parecord/arecord/ffmpeg)", "error");
			return false;
		}
	}

	active = true;
	const isParecord = cmd === "parecord";
	proc = spawn(cmd, args, { stdio: "ignore", env });

	// 收集 stderr 用于诊断
	let stderrBuf = "";
	if (proc.stderr) {
		proc.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
	}

	proc.on("error", (e) => {
		notify(`❌ 录音失败: ${e.message}`, "error");
		active = false;
	});
	proc.on("exit", (code) => {
		if (active && code !== 0) {
			let hint: string;
			if (stderrBuf.includes("Connection") || stderrBuf.includes("timeout")) {
				hint = "PulseServer 断开，请重启 WSL (wsl --shutdown)";
			} else if (code === 1 && cmd === "parecord") {
				hint = `parecord 退出 (code=1) — 请检查 Windows 是否允许了麦克风权限`;
			} else {
				hint = `${cmd} 录音异常 (code=${code})`;
			}
			notify(`❌ ${hint}`, "error");
			active = false;
			if (timer) { clearTimeout(timer); timer = null; }
		}
	});

	// 等 500ms 确认进程没崩
	await new Promise((r) => setTimeout(r, 500));
	if (!active || proc?.exitCode !== null) {
		if (active) { notify("❌ 录音启动失败（麦克风不可用）", "error"); active = false; }
		return false;
	}
	return true;
}

async function transcribe(pi: ExtensionAPI) {
	await stopProc();
	await new Promise((r) => setTimeout(r, 200));
	if (!existsSync(wavFile)) { notify("❌ 录音文件不存在", "error"); return; }

	notify("🔄 正在识别...");
	try {
		const platDir = join(__dirname, "node_modules/sherpa-onnx-linux-x64");
		if (existsSync(platDir)) {
			process.env.LD_LIBRARY_PATH = [platDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
		}
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const sherpa = require("sherpa-onnx-node") as any;
		const recognizer = new sherpa.OfflineRecognizer({
			featConfig: { sampleRate: SR, featureDim: 80 },
			modelConfig: {
				senseVoice: {
					model: join(MODEL_DIR, "model.int8.onnx"),
					useInverseTextNormalization: 1,
				},
				tokens: join(MODEL_DIR, "tokens.txt"),
				numThreads: 2, provider: "cpu", debug: 0,
			},
		});
		const stream = recognizer.createStream();
		const wave = sherpa.readWave(wavFile);
		if (!wave?.samples?.length) throw new Error("录音为空");
		stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
		recognizer.decode(stream);
		const { text } = recognizer.getResult(stream);
		try { unlinkSync(wavFile); } catch {}
		if (text?.trim()) { pi.sendUserMessage(text.trim()); }
		else { notify("❌ 未识别到语音", "warning"); }
	} catch (e: any) {
		notify(`❌ 识别失败: ${e.message}`, "error");
	}
}

export async function toggleVoice(pi: ExtensionAPI, ctx: any) {
	if (active) {
		await transcribe(pi);
	} else {
		savedCtx = ctx;
		if (!modelReady() && !(await download())) return;
		if (!(await startRec())) return;
		timer = setTimeout(() => {
			if (active) { notify("⏱ 录音超时"); transcribe(pi); }
		}, MAX_SEC * 1000);
		notify("🎤 录音中... 再次 /voice 或 Ctrl+Alt+V 停止");
	}
}
