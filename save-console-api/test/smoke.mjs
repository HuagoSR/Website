import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'save-console-test-'));
const port = 14312;
const baseUrl = `http://127.0.0.1:${port}`;
const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const legacyArchive = Buffer.concat([
	Buffer.from([0x50, 0x4b, 0x05, 0x06]),
	Buffer.alloc(18)
]);
const legacyWorldDir = path.join(dataRoot, 'worlds', 'LegacyWorld');
await fs.mkdir(path.join(legacyWorldDir, 'versions'), { recursive: true });
await fs.writeFile(path.join(legacyWorldDir, 'versions', 'LegacyWorld.zip'), legacyArchive);
await fs.writeFile(
	path.join(legacyWorldDir, 'latest.json'),
	JSON.stringify({
		world: 'LegacyWorld',
		latest_file: 'LegacyWorld.zip',
		size: legacyArchive.length,
		uploaded_at: '2026-06-25T13:49:39Z'
	})
);

const child = spawn(process.execPath, [serverPath], {
	env: {
		...process.env,
		SAVE_CONSOLE_HOST: '127.0.0.1',
		SAVE_CONSOLE_PORT: String(port),
		SAVE_CONSOLE_DATA_ROOT: dataRoot,
		SAVE_CONSOLE_DEFAULT_USER: 'tester',
		SAVE_CONSOLE_DEFAULT_OWNER: 'tester'
	},
	stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr.on('data', (chunk) => {
	stderr += chunk.toString();
});

async function waitForServer() {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		try {
			const response = await fetch(`${baseUrl}/health`);
			if (response.ok) return;
		} catch {
			// The service is still starting.
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error(`Save console did not start. ${stderr}`);
}

async function requestJson(url, options) {
	const response = await fetch(`${baseUrl}${url}`, options);
	const payload = await response.json();
	return { response, payload };
}

try {
	await waitForServer();

	const created = await requestJson('/api/saves/worlds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			slug: 'test-world',
			displayName: 'Test World',
			description: 'Smoke test world',
			retentionCount: 3,
			allowedUsers: ['tester']
		})
	});
	assert.equal(created.response.status, 201);
	assert.equal(created.payload.data.world.slug, 'test-world');

	const duplicate = await requestJson('/api/saves/worlds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug: 'test-world', displayName: 'Duplicate' })
	});
	assert.equal(duplicate.response.status, 409);
	assert.equal(duplicate.payload.error.code, 'world_already_exists');

	const legacyDuplicate = await requestJson('/api/saves/worlds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug: 'legacyworld', displayName: 'Legacy Duplicate' })
	});
	assert.equal(legacyDuplicate.response.status, 409);
	assert.equal(legacyDuplicate.payload.error.code, 'world_already_exists');

	const invalid = await requestJson('/api/saves/worlds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug: '../escape', displayName: 'Escape' })
	});
	assert.equal(invalid.response.status, 400);
	assert.equal(invalid.payload.error.code, 'invalid_slug');

	const fakeArchive = await requestJson('/api/saves/worlds/test-world/upload', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/zip',
			'X-Save-Filename': 'fake.zip'
		},
		body: Buffer.from('not a zip')
	});
	assert.equal(fakeArchive.response.status, 400);
	assert.equal(fakeArchive.payload.error.code, 'invalid_archive');

	const emptyZip = Buffer.concat([
		Buffer.from([0x50, 0x4b, 0x05, 0x06]),
		Buffer.alloc(18)
	]);
	const uploaded = await requestJson('/api/saves/worlds/test-world/upload', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/zip',
			'X-Save-Filename-Encoded': encodeURIComponent('测试存档.zip'),
			'X-Save-Note-Encoded': encodeURIComponent('冒烟测试')
		},
		body: emptyZip
	});
	assert.equal(uploaded.response.status, 201);
	assert.equal(uploaded.payload.data.version.note, '冒烟测试');

	const worlds = await requestJson('/api/saves/worlds');
	assert.equal(worlds.response.status, 200);
	assert.equal(worlds.payload.data.worlds.length, 2);
	assert.equal(
		worlds.payload.data.worlds.find((world) => world.slug === 'test-world').latestVersion.size,
		emptyZip.length
	);
	assert.ok(worlds.payload.data.worlds.some((world) => world.slug === 'legacyworld'));

	const download = await fetch(`${baseUrl}/api/saves/worlds/test-world/download/latest`);
	assert.equal(download.status, 200);
	assert.equal(download.headers.get('content-type'), 'application/zip');
	assert.deepEqual(Buffer.from(await download.arrayBuffer()), emptyZip);

	const legacyDownload = await fetch(`${baseUrl}/api/saves/worlds/legacyworld/download/latest`);
	assert.equal(legacyDownload.status, 200);
	assert.deepEqual(Buffer.from(await legacyDownload.arrayBuffer()), legacyArchive);

	console.log('Save console smoke test passed.');
} finally {
	child.kill('SIGTERM');
	await new Promise((resolve) => {
		const timeout = setTimeout(resolve, 1000);
		child.once('exit', () => {
			clearTimeout(timeout);
			resolve();
		});
	});
	await fs.rm(dataRoot, { recursive: true, force: true });
}
