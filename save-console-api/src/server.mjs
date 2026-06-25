import http from 'node:http';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { loadConfig } from './config.mjs';
import {
	createRequestUploadTarget,
	getVisibleWorld,
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

function parseOptionalInt(value) {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
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

	const uploadMatch = pathName.match(/^\/api\/saves\/worlds\/([^/]+)\/upload$/);
	if (method === 'POST' && uploadMatch) {
		const slug = decodeURIComponent(uploadMatch[1]);
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

		const sourceFilenameHeader = request.headers['x-save-filename'];
		const sourceFilename =
			typeof sourceFilenameHeader === 'string' && sourceFilenameHeader.trim()
				? sourceFilenameHeader.trim()
				: null;
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

		const noteHeader = request.headers['x-save-note'];
		const note =
			typeof noteHeader === 'string' && noteHeader.trim() ? noteHeader.trim().slice(0, 200) : '';
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
