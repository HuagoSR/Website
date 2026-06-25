import fs from 'node:fs/promises';
import path from 'node:path';

function toIsoFromStats(stats) {
	return stats.mtime.toISOString();
}

async function readJsonIfExists(filePath) {
	try {
		const raw = await fs.readFile(filePath, 'utf8');
		return JSON.parse(raw.replace(/^\uFEFF/, ''));
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

function sortNewestFirst(items) {
	return [...items].sort((a, b) => {
		const left = new Date(a.uploadedAt || a.updatedAt || 0).valueOf();
		const right = new Date(b.uploadedAt || b.updatedAt || 0).valueOf();
		return right - left;
	});
}

function sanitizeSlug(slug) {
	return slug.trim().toLowerCase();
}

function canAccessWorld(world, userId, defaultOwner) {
	if (!world.allowedUsers || world.allowedUsers.length === 0) {
		return userId === defaultOwner;
	}
	return world.allowedUsers.includes(userId);
}

async function loadVersionsFromLegacy(worldDir, latest) {
	const versionsDir = path.join(worldDir, 'versions');
	let entries = [];
	try {
		entries = await fs.readdir(versionsDir, { withFileTypes: true });
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}

	const versions = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.zip')) {
			continue;
		}
		const archivePath = path.join(versionsDir, entry.name);
		const stats = await fs.stat(archivePath);
		const isLatest = latest && latest.filename === entry.name;
		versions.push({
			id: isLatest && latest.versionId ? latest.versionId : `ver_${entry.name.replace(/\.zip$/i, '')}`,
			filename: entry.name,
			size: stats.size,
			sha256: isLatest ? latest.sha256 || null : null,
			uploadedAt: isLatest ? latest.uploadedAt : toIsoFromStats(stats),
			uploadedBy: isLatest ? latest.uploadedBy || null : null,
			note: isLatest ? latest.note || '' : '',
			sourceType: isLatest ? latest.sourceType || 'legacy-upload' : 'legacy-upload'
		});
	}
	return sortNewestFirst(versions);
}

async function loadWorldRecord(config, slug) {
	const worldDir = path.join(config.worldsRoot, slug);
	const worldJson = await readJsonIfExists(path.join(worldDir, 'world.json'));
	const latestJson = await readJsonIfExists(path.join(worldDir, 'latest.json'));
	const versionsJson = await readJsonIfExists(path.join(worldDir, 'versions.json'));

	if (!worldJson && !latestJson && !versionsJson) {
		return null;
	}

	const displayName = worldJson?.displayName || latestJson?.world || slug;
	const allowedUsers = Array.isArray(worldJson?.allowedUsers)
		? worldJson.allowedUsers
		: [config.defaultOwner];
	const normalizedLatest = latestJson
		? {
				worldId: latestJson.worldId || `world_${slug}`,
				versionId:
					latestJson.versionId ||
					(latestJson.latest_file
						? `ver_${String(latestJson.latest_file).replace(/\.zip$/i, '')}`
						: null),
				filename: latestJson.filename || latestJson.latest_file || null,
				size: latestJson.size ?? null,
				sha256: latestJson.sha256 ?? null,
				uploadedAt: latestJson.uploadedAt || latestJson.uploaded_at || null,
				uploadedBy: latestJson.uploadedBy || latestJson.device || null,
				note: latestJson.note || '',
				sourceType: latestJson.sourceType || 'legacy-upload'
			}
		: null;
	const versions = Array.isArray(versionsJson?.versions)
		? sortNewestFirst(versionsJson.versions)
		: await loadVersionsFromLegacy(worldDir, normalizedLatest);
	const latestVersion = versions[0] || null;

	return {
		id: worldJson?.id || `world_${slug}`,
		slug,
		displayName,
		description: worldJson?.description || '',
		retentionCount: worldJson?.retentionCount ?? 20,
		allowedUsers,
		tags: Array.isArray(worldJson?.tags) ? worldJson.tags : [],
		createdAt: worldJson?.createdAt || latestVersion?.uploadedAt || null,
		updatedAt: worldJson?.updatedAt || latestVersion?.uploadedAt || null,
		latestVersionId: latestVersion?.id || null,
		latestVersion,
		versions
	};
}

export async function listVisibleWorlds(config, userId) {
	let entries = [];
	try {
		entries = await fs.readdir(config.worldsRoot, { withFileTypes: true });
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}

	const worlds = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const slug = sanitizeSlug(entry.name);
		const world = await loadWorldRecord(config, slug);
		if (!world) {
			continue;
		}
		if (!canAccessWorld(world, userId, config.defaultOwner)) {
			continue;
		}
		worlds.push({
			id: world.id,
			slug: world.slug,
			displayName: world.displayName,
			description: world.description,
			updatedAt: world.updatedAt,
			latestVersion: world.latestVersion
				? {
						id: world.latestVersion.id,
						filename: world.latestVersion.filename,
						size: world.latestVersion.size,
						uploadedAt: world.latestVersion.uploadedAt,
						uploadedBy: world.latestVersion.uploadedBy
					}
				: null
		});
	}

	return sortNewestFirst(worlds);
}

export async function getVisibleWorld(config, userId, slug) {
	const world = await loadWorldRecord(config, sanitizeSlug(slug));
	if (!world) {
		return null;
	}
	if (!canAccessWorld(world, userId, config.defaultOwner)) {
		return null;
	}
	return world;
}
