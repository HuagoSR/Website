import path from 'node:path';

function getEnv(name, fallback) {
	return process.env[name] || fallback;
}

export function loadConfig() {
	const port = Number.parseInt(getEnv('SAVE_CONSOLE_PORT', '4312'), 10);
	const host = getEnv('SAVE_CONSOLE_HOST', '127.0.0.1');
	const dataRoot = getEnv('SAVE_CONSOLE_DATA_ROOT', '/home/huagosr/mc-cloud');
	const defaultUser = getEnv('SAVE_CONSOLE_DEFAULT_USER', 'huagosr');
	const defaultOwner = getEnv('SAVE_CONSOLE_DEFAULT_OWNER', 'huagosr');
	const publicBase = getEnv('SAVE_CONSOLE_PUBLIC_BASE', '/api/saves');
	const maxUploadBytes = Number.parseInt(getEnv('SAVE_CONSOLE_MAX_UPLOAD_BYTES', '2147483648'), 10);

	return {
		port: Number.isNaN(port) ? 4312 : port,
		host,
		dataRoot,
		defaultUser,
		defaultOwner,
		publicBase,
		maxUploadBytes: Number.isNaN(maxUploadBytes) ? 2147483648 : maxUploadBytes,
		worldsRoot: path.join(dataRoot, 'worlds')
	};
}
