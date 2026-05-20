/**
 * semaphore 信号量测试
 *
 * 验证并发控制信号量的正确性：
 * - 并发限制
 * - 排队机制
 * - 唤醒机制
 * - 计数不泄漏
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { semaphore } from "./semaphore";

describe("semaphore", () => {
	it("semaphore(2) allows 2 concurrent acquires", async () => {
		const sem = semaphore(2);
		const release1 = await sem.acquire();
		const release2 = await sem.acquire();
		release1();
		release2();
	});

	it("3rd acquire blocks until a release", async () => {
		const sem = semaphore(1);
		const release1 = await sem.acquire();

		let thirdAcquired = false;
		const thirdPromise = sem.acquire().then(release => {
			thirdAcquired = true;
			release();
		});

		// Give time for microtasks to settle
		await new Promise(r => setTimeout(r, 20));
		assert.equal(thirdAcquired, false, "3rd acquire should block");

		release1();
		await thirdPromise;
		assert.equal(thirdAcquired, true, "3rd acquire should proceed after release");
	});

	it("released slot wakes the next waiting acquirer in order", async () => {
		const sem = semaphore(1);
		const release1 = await sem.acquire();

		const order: number[] = [];
		const p2 = sem.acquire().then(release => { order.push(2); release(); });
		const p3 = sem.acquire().then(release => { order.push(3); release(); });

		await new Promise(r => setTimeout(r, 20));
		assert.deepEqual(order, []);

		release1();
		await p2;
		assert.deepEqual(order, [2], "first queued acquirer should proceed");

		// Now slot is free again, p3 should proceed
		await new Promise(r => setTimeout(r, 20));
		// p3 might have been woken when p2 released
	});

	it("multiple acquire+release cycles don't leak counter", async () => {
		const sem = semaphore(2);
		for (let i = 0; i < 100; i++) {
			const release = await sem.acquire();
			release();
		}
		// Counter should still be 2 (not leaked)
		const r1 = await sem.acquire();
		const r2 = await sem.acquire();
		let blocked = false;
		sem.acquire().then(r => { blocked = true; r(); });
		await new Promise(r => setTimeout(r, 20));
		assert.equal(blocked, false, "3rd acquire should block with limit=2");
		r1();
		r2();
	});

	it("works with limit of 0 (no concurrency)", async () => {
		const sem = semaphore(0);
		let acquired = false;
		const p = sem.acquire().then(release => { acquired = true; release(); });
		await new Promise(r => setTimeout(r, 20));
		assert.equal(acquired, false, "acquire with limit 0 should block forever");
		// Clean up - no one will release, we just leave the promise
	});

	it("release does nothing if called multiple times", async () => {
		const sem = semaphore(1);
		const release = await sem.acquire();
		release(); // first release: counter goes to 1
		release(); // second release: should not increment counter

		// Should still be able to acquire once only
		const r1 = await sem.acquire();
		let blocked = false;
		sem.acquire().then(r => { blocked = true; r(); });
		await new Promise(r => setTimeout(r, 20));
		assert.equal(blocked, false, "counter should match limit after double release");
		r1();
	});
});
