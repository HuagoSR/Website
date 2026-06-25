import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

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

function sanitizeArchiveBaseName(name) {
	return name
		.replace(/\.zip$/i, '')
		.replace(/[^a-zA-Z0-9_-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function timestampId() {
	return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function canAccessWorld(world, userId, defaultOwner) {
	if (!world.allowedUsers || world.allowedUsers.length === 0) {
		return userId === defaultOwner;
	}
	return world.allowedUsers.includes(userId);
}

function canUploadWorld(world, userId, defaultOwner) {
	return canAccessWorld(world, userId, defaultOwner) && userId === defaultOwner;
}

async function ensureDirectory(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function writeJsonAtomic(filePath, payload) {
	const tempPath = `${filePath}.tmp-${Date.now()}`;
	await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	await fs.rename(tempPath, filePath);
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

export async function saveUploadedVersion(
	config,
	userId,
	slug,
	{ sourceFilename, note, tempFilePath, size, sha256 }
) {
	const world = await getVisibleWorld(config, userId, slug);
	if (!world) {
		return { error: 'world_not_found' };
	}
	if (!canUploadWorld(world, userId, config.defaultOwner)) {
		return { error: 'forbidden' };
	}

	const worldDir = path.join(config.worldsRoot, world.slug);
	const versionsDir = path.join(worldDir, 'versions');
	const uploadsDir = path.join(worldDir, 'uploads');
	await ensureDirectory(versionsDir);
	await ensureDirectory(uploadsDir);

	const stamp = timestampId();
	const versionId = `ver_${stamp}`;
	const archiveBase =
		sanitizeArchiveBaseName(world.displayName || sourceFilename || world.slug) || world.slug;
	const finalFilename = `${archiveBase}-${stamp}.zip`;
	const finalArchivePath = path.join(versionsDir, finalFilename);
	await fs.rename(tempFilePath, finalArchivePath);

	const versionRecord = {
		id: versionId,
		filename: finalFilename,
		size,
		sha256,
		uploadedAt: new Date().toISOString(),
		uploadedBy: userId,
		note: note || '',
		sourceType: 'raw-upload'
	};

	const versions = sortNewestFirst([versionRecord, ...world.versions]);
	const versionsPayload = {
		worldId: world.id,
		versions
	};
	const latestPayload = {
		worldId: world.id,
		versionId,
		filename: versionRecord.filename,
		size: versionRecord.size,
		sha256: versionRecord.sha256,
		uploadedAt: versionRecord.uploadedAt,
		uploadedBy: versionRecord.uploadedBy,
		note: versionRecord.note,
		sourceType: versionRecord.sourceType
	};

	await writeJsonAtomic(path.join(worldDir, 'versions.json'), versionsPayload);
	await writeJsonAtomic(path.join(worldDir, 'latest.json'), latestPayload);
	const existingWorldJson = await readJsonIfExists(path.join(worldDir, 'world.json'));
	await writeJsonAtomic(path.join(worldDir, 'world.json'), {
		id: existingWorldJson?.id || world.id,
		slug: existingWorldJson?.slug || world.slug,
		displayName: existingWorldJson?.displayName || world.displayName,
		description: existingWorldJson?.description || world.description,
		createdAt: existingWorldJson?.createdAt || world.createdAt || versionRecord.uploadedAt,
		updatedAt: versionRecord.uploadedAt,
		retentionCount: existingWorldJson?.retentionCount ?? world.retentionCount,
		allowedUsers: existingWorldJson?.allowedUsers || world.allowedUsers,
		tags: existingWorldJson?.tags || world.tags
	});

	if (world.retentionCount > 0 && versions.length > world.retentionCount) {
		const staleVersions = versions.slice(world.retentionCount);
		for (const stale of staleVersions) {
			const stalePath = path.join(versionsDir, stale.filename);
			await fs.rm(stalePath, { force: true });
		}
		const keptVersions = versions.slice(0, world.retentionCount);
		await writeJsonAtomic(path.join(worldDir, 'versions.json'), {
			worldId: world.id,
			versions: keptVersions
		});
	}

	return {
		world: await getVisibleWorld(config, userId, world.slug),
		version: versionRecord
	};
}

export function createRequestUploadTarget(config, slug) {
	const safeSlug = sanitizeSlug(slug);
	const requestId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
	const worldDir = path.join(config.worldsRoot, safeSlug);
	const uploadsDir = path.join(worldDir, 'uploads');
	const tempFilePath = path.join(uploadsDir, `${requestId}.upload`);
	return { safeSlug, uploadsDir, tempFilePath };
}
