import http from 'node:http';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { loadConfig } from './config.mjs';
import {
	createWorld,
	createRequestUploadTarget,
	getDownloadVersion,
	getVisibleWorld,
	isValidWorldSlug,
	listVisibleWorlds,
	saveUploadedVersion
} from './storage.mjs';

const config = loadConfig();

function json(response, statusCode, payload) {
	response.writeHead(statusCode, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store'
	});
	response.end(JSON.stringify(payload, null, 2));
}

function ok(response, data) {
	json(response, 200, { ok: true, data });
}

function fail(response, statusCode, code, message) {
	json(response, statusCode, {
		ok: false,
		error: { code, message }
	});
}

function escapeHeaderFilename(name) {
	return encodeURIComponent(name)
		.replace(/'/g, '%27')
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29')
		.replace(/\*/g, '%2A');
}

async function streamArchiveResponse(response, archivePath, filename) {
	const stats = await fsPromises.stat(archivePath);
	response.writeHead(200, {
		'Content-Type': 'application/zip',
		'Content-Length': String(stats.size),
		'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${escapeHeaderFilename(filename)}`,
		'Cache-Control': 'no-store'
	});

	await new Promise((resolve, reject) => {
		const stream = fs.createReadStream(archivePath);
		stream.on('error', reject);
		response.on('close', resolve);
		response.on('finish', resolve);
		stream.pipe(response);
	});
}

function parseOptionalInt(value) {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

async function readJsonBody(request, maxBytes = 16 * 1024) {
	const chunks = [];
	let size = 0;

	for await (const chunk of request) {
		size += chunk.length;
		if (size > maxBytes) {
			throw new Error('request_too_large');
		}
		chunks.push(chunk);
	}

	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		throw new Error('invalid_json');
	}
}

function decodeHeaderValue(request, encodedName, fallbackName) {
	const encodedValue = request.headers[encodedName];
	if (typeof encodedValue === 'string' && encodedValue.trim()) {
		try {
			return decodeURIComponent(encodedValue.trim());
		} catch {
			return null;
		}
	}
	const fallbackValue = request.headers[fallbackName];
	return typeof fallbackValue === 'string' && fallbackValue.trim() ? fallbackValue.trim() : null;
}

async function streamRequestToTempFile(request, tempFilePath, maxUploadBytes) {
	const targetDir = tempFilePath.replace(/[\\/][^\\/]+$/, '');
	await fsPromises.mkdir(targetDir, { recursive: true });

	const hash = crypto.createHash('sha256');
	let size = 0;

	await new Promise((resolve, reject) => {
		const fileStream = fs.createWriteStream(tempFilePath, { flags: 'wx' });
		let settled = false;

		const failOnce = async (error) => {
			if (settled) return;
			settled = true;
			request.destroy();
			fileStream.destroy();
			await fsPromises.rm(tempFilePath, { force: true }).catch(() => undefined);
			reject(error);
		};

		request.on('data', (chunk) => {
			size += chunk.length;
			if (size > maxUploadBytes) {
				void failOnce(new Error('upload_too_large'));
				return;
			}
			hash.update(chunk);
		});

		request.on('error', (error) => {
			void failOnce(error);
		});

		fileStream.on('error', (error) => {
			void failOnce(error);
		});

		fileStream.on('finish', () => {
			if (settled) return;
			settled = true;
			resolve();
		});

		request.pipe(fileStream);
	});

	return {
		size,
		sha256: hash.digest('hex')
	};
}

async function isZipArchive(filePath) {
	const handle = await fsPromises.open(filePath, 'r');
	try {
		const signature = Buffer.alloc(4);
		const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
		if (bytesRead < 4) return false;
		return (
			signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
			signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
			signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
		);
	} finally {
		await handle.close();
	}
}

function getUserId(request) {
	const remoteUser = request.headers['x-remote-user'];
	const forwardedUser = request.headers['x-forwarded-user'];
	const saveConsoleUser = request.headers['x-save-console-user'];
	const user =
		(typeof saveConsoleUser === 'string' && saveConsoleUser) ||
		(typeof remoteUser === 'string' && remoteUser) ||
		(typeof forwardedUser === 'string' && forwardedUser) ||
		config.defaultUser;
	return user.trim();
}

function getUserRole(userId) {
	if (userId === config.defaultOwner) {
		return 'admin';
	}
	return 'viewer';
}

function buildWorldSummary(world) {
	return {
		world: {
			id: world.id,
			slug: world.slug,
			displayName: world.displayName,
			description: world.description,
			retentionCount: world.retentionCount,
			allowedUsers: world.allowedUsers,
			tags: world.tags,
			createdAt: world.createdAt,
			updatedAt: world.updatedAt,
			latestVersionId: world.latestVersionId
		},
		latestVersion: world.latestVersion
	};
}

async function routeRequest(request, response) {
	const method = request.method || 'GET';
	const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
	const pathName = requestUrl.pathname;
	const userId = getUserId(request);

	if (method === 'GET' && pathName === '/health') {
		return ok(response, {
			status: 'ok',
			service: 'minecraft-save-console-api'
		});
	}

	if (method === 'GET' && pathName === `${config.publicBase}/me`) {
		return ok(response, {
			user: {
				id: userId,
				displayName: userId,
				role: getUserRole(userId)
			},
			capabilities: {
				canCreateWorld: getUserRole(userId) === 'admin'
			}
		});
	}

	if (method === 'GET' && pathName === `${config.publicBase}/worlds`) {
		const worlds = await listVisibleWorlds(config, userId);
		return ok(response, { worlds });
	}

	if (method === 'POST' && pathName === `${config.publicBase}/worlds`) {
		if (getUserRole(userId) !== 'admin') {
			return fail(response, 403, 'forbidden', 'You do not have permission to create worlds.');
		}

		try {
			const body = await readJsonBody(request);
			if (!body || typeof body !== 'object' || Array.isArray(body)) {
				return fail(response, 400, 'invalid_json', 'The request body must be a JSON object.');
			}
			const result = await createWorld(config, userId, {
				slug: body.slug,
				displayName: body.displayName,
				description: body.description,
				retentionCount: body.retentionCount,
				allowedUsers: body.allowedUsers
			});

			if (result.error === 'invalid_slug') {
				return fail(
					response,
					400,
					'invalid_slug',
					'World slug must use 1-64 lowercase letters, numbers, hyphens, or underscores.'
				);
			}
			if (result.error === 'invalid_display_name') {
				return fail(response, 400, 'invalid_display_name', 'World display name is required.');
			}
			if (result.error === 'world_already_exists') {
				return fail(response, 409, 'world_already_exists', 'A world with this slug already exists.');
			}
			if (result.error === 'forbidden') {
				return fail(response, 403, 'forbidden', 'You do not have permission to create worlds.');
			}

			return json(response, 201, { ok: true, data: result });
		} catch (error) {
			if (error instanceof Error && error.message === 'request_too_large') {
				return fail(response, 413, 'request_too_large', 'The request body is too large.');
			}
			if (error instanceof Error && error.message === 'invalid_json') {
				return fail(response, 400, 'invalid_json', 'The request body must be valid JSON.');
			}
			throw error;
		}
	}

	const worldMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)$/);
	if (method === 'GET' && worldMatch) {
		const world = await getVisibleWorld(config, userId, decodeURIComponent(worldMatch[1]));
		if (!world) {
			return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
		}
		return ok(response, buildWorldSummary(world));
	}

	const versionsMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)\/versions$/);
	if (method === 'GET' && versionsMatch) {
		const world = await getVisibleWorld(config, userId, decodeURIComponent(versionsMatch[1]));
		if (!world) {
			return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
		}
		return ok(response, { versions: world.versions, nextCursor: null });
	}

	const latestDownloadMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)\/download\/latest$/);
	if (method === 'GET' && latestDownloadMatch) {
		const slug = decodeURIComponent(latestDownloadMatch[1]);
		const result = await getDownloadVersion(config, userId, slug, 'latest');
		if (result.error === 'world_not_found') {
			return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
		}
		if (result.error === 'version_not_found') {
			return fail(response, 404, 'version_not_found', 'The requested version does not exist.');
		}
		await streamArchiveResponse(response, result.archivePath, result.version.filename);
		return;
	}

	const versionDownloadMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)\/download\/([^/]+)$/);
	if (method === 'GET' && versionDownloadMatch) {
		const slug = decodeURIComponent(versionDownloadMatch[1]);
		const versionId = decodeURIComponent(versionDownloadMatch[2]);
		const result = await getDownloadVersion(config, userId, slug, versionId);
		if (result.error === 'world_not_found') {
			return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
		}
		if (result.error === 'version_not_found') {
			return fail(response, 404, 'version_not_found', 'The requested version does not exist.');
		}
		await streamArchiveResponse(response, result.archivePath, result.version.filename);
		return;
	}

	const uploadMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)\/upload$/);
	if (method === 'POST' && uploadMatch) {
		const slug = decodeURIComponent(uploadMatch[1]);
		if (!isValidWorldSlug(slug)) {
			return fail(response, 400, 'invalid_slug', 'The world slug is invalid.');
		}
		const world = await getVisibleWorld(config, userId, slug);
		if (!world) {
			return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
		}
		if (getUserRole(userId) !== 'admin') {
			return fail(response, 403, 'forbidden', 'You do not have permission to upload for this world.');
		}

		const contentLength = parseOptionalInt(request.headers['content-length']);
		if (contentLength !== null && contentLength > config.maxUploadBytes) {
			return fail(
				response,
				413,
				'upload_too_large',
				`The uploaded archive exceeds the ${config.maxUploadBytes} byte limit.`
			);
		}

		const sourceFilename = decodeHeaderValue(
			request,
			'x-save-filename-encoded',
			'x-save-filename'
		);
		if (!sourceFilename || !sourceFilename.toLowerCase().endsWith('.zip')) {
			return fail(response, 400, 'invalid_archive', 'A .zip filename is required.');
		}

		const contentType = typeof request.headers['content-type'] === 'string' ? request.headers['content-type'] : '';
		if (contentType && !contentType.includes('application/zip') && !contentType.includes('application/octet-stream')) {
			return fail(
				response,
				400,
				'invalid_archive',
				'Only application/zip or application/octet-stream uploads are supported.'
			);
		}

		const decodedNote = decodeHeaderValue(request, 'x-save-note-encoded', 'x-save-note');
		const note = decodedNote ? decodedNote.trim().slice(0, 200) : '';
		const uploadTarget = createRequestUploadTarget(config, slug);

		try {
			const uploadMeta = await streamRequestToTempFile(
				request,
				uploadTarget.tempFilePath,
				config.maxUploadBytes
			);
			if (uploadMeta.size === 0) {
				await fsPromises.rm(uploadTarget.tempFilePath, { force: true }).catch(() => undefined);
				return fail(response, 400, 'invalid_archive', 'The uploaded archive is empty.');
			}
			if (!(await isZipArchive(uploadTarget.tempFilePath))) {
				await fsPromises.rm(uploadTarget.tempFilePath, { force: true }).catch(() => undefined);
				return fail(response, 400, 'invalid_archive', 'The uploaded file is not a valid ZIP archive.');
			}

			const result = await saveUploadedVersion(config, userId, slug, {
				sourceFilename,
				note,
				tempFilePath: uploadTarget.tempFilePath,
				size: uploadMeta.size,
				sha256: uploadMeta.sha256
			});

			if (result.error === 'forbidden') {
				return fail(response, 403, 'forbidden', 'You do not have permission to upload for this world.');
			}
			if (result.error === 'world_not_found') {
				return fail(response, 404, 'world_not_found', 'The requested world does not exist.');
			}

			return json(response, 201, {
				ok: true,
				data: {
					version: result.version,
					world: result.world
				}
			});
		} catch (error) {
			await fsPromises.rm(uploadTarget.tempFilePath, { force: true }).catch(() => undefined);
			if (error instanceof Error && error.message === 'upload_too_large') {
				return fail(
					response,
					413,
					'upload_too_large',
					`The uploaded archive exceeds the ${config.maxUploadBytes} byte limit.`
				);
			}
			throw error;
		}
	}

	return fail(response, 404, 'not_found', 'The requested endpoint does not exist.');
}

export const server = http.createServer(async (request, response) => {
	try {
		await routeRequest(request, response);
	} catch (error) {
		console.error('[save-console-api] request failed', error);
		fail(response, 500, 'internal_error', 'The save console API hit an unexpected error.');
	}
});

server.listen(config.port, config.host, () => {
	console.log(
		`[save-console-api] listening on http://${config.host}:${config.port} with data root ${config.dataRoot}`
	);
});

function shutdown() {
	server.close(() => {
		process.exit(0);
	});
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
