import http from 'node:http';
import { URL } from 'node:url';
import { loadConfig } from './config.mjs';
import { getVisibleWorld, listVisibleWorlds } from './storage.mjs';

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
