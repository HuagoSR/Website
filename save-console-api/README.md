# Save Console API

This service powers the protected Minecraft save console for `huago.cloud`.

Current scope:

- health check
- current user endpoint
- world list
- admin-only world creation
- world detail
- version history
- raw zip upload endpoint
- latest archive download endpoint
- historical archive download endpoint

The current implementation supports multi-world management, manual zip upload, and direct archive download.

## Run locally

```bash
node ./src/server.mjs
```

## Smoke test

The smoke test uses a temporary data directory and does not touch real saves.

```bash
pnpm save-console:test
```

It covers world creation, duplicate and invalid slug rejection, ZIP signature
validation, upload metadata, and download round-tripping.

## Environment variables

- `SAVE_CONSOLE_PORT`
- `SAVE_CONSOLE_HOST`
- `SAVE_CONSOLE_DATA_ROOT`
- `SAVE_CONSOLE_DEFAULT_USER`
- `SAVE_CONSOLE_DEFAULT_OWNER`
- `SAVE_CONSOLE_PUBLIC_BASE`

## Reverse proxy expectation

The service expects nginx to protect the route first and forward a user header such as:

- `X-Remote-User`

For local development, it falls back to `SAVE_CONSOLE_DEFAULT_USER`.
