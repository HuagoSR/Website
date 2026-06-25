# Save Console API

This service powers the protected Minecraft save console for `huago.cloud`.

Current scope:

- health check
- current user endpoint
- world list
- world detail
- version history
- raw zip upload endpoint

The current implementation now supports manual zip upload. Download streaming is the next step.

## Run locally

```bash
node ./src/server.mjs
```

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
