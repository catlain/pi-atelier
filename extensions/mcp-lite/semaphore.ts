/**
 * 信号量 — 并发控制
 *
 * 用于限制 GLM MCP 工具最多同时 2 个并发调用。
 * 纯 Promise 实现，无外部依赖。
 */

export interface Semaphore {
	acquire(): Promise<() => void>;
}

export function semaphore(limit: number): Semaphore {
	let running = 0;
	const queue: Array<() => void> = [];
	let released = false;

	return {
		acquire(): Promise<() => void> {
			return new Promise<() => void>((resolve) => {
				const tryAcquire = () => {
					if (running < limit) {
						running++;
						released = false;
						resolve(() => {
							if (released) return;
							released = true;
							running--;
							const next = queue.shift();
							// queueMicrotask 确保排队者在当前微任务后唤醒
							if (next) queueMicrotask(next);
						});
					} else {
						queue.push(tryAcquire);
					}
				};
				tryAcquire();
			});
		},
	};
}
