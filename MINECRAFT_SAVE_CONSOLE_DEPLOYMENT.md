# Minecraft Save Console Deployment Notes

## 1. Current Direction

Phase 1 uses:

- the existing Astro site for the `/saves` page
- a separate Node service for `/api/saves/*`
- nginx Basic Auth in front of both routes

## 2. Service Layout

Recommended server paths:

- website static files: `/home/huagosr/my_website/html`
- save console API code: `/home/huagosr/my_website/save-console-api`
- save archives: `/home/huagosr/mc-cloud`

Do not mix save archives into the static site directory.

## 3. Basic Auth

Create an htpasswd file on the server, for example:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd_saves huagosr
```

Add additional users later with:

```bash
sudo htpasswd /etc/nginx/.htpasswd_saves friend_a
```

## 4. Nginx Changes

The current nginx server block only serves static files.

To enable the save console:

1. add the `/saves` protected static route
2. add the `/api/saves/` reverse proxy
3. forward `X-Remote-User`
4. raise upload size limits for future upload support

Use the sample snippet in:

- `save-console-api/nginx/save-console.conf.snippet`

## 5. Node Service

The sample systemd unit lives at:

- `save-console-api/systemd/minecraft-save-console.service`

Recommended deployment flow:

1. copy the `save-console-api` folder to `/home/huagosr/my_website/save-console-api`
2. install the systemd unit
3. enable and start the service
4. reload nginx

Example:

```bash
sudo cp /home/huagosr/my_website/save-console-api/systemd/minecraft-save-console.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable minecraft-save-console
sudo systemctl start minecraft-save-console
sudo systemctl status minecraft-save-console
```

## 6. Environment

The service currently expects:

- `SAVE_CONSOLE_HOST=127.0.0.1`
- `SAVE_CONSOLE_PORT=4312`
- `SAVE_CONSOLE_DATA_ROOT=/home/huagosr/mc-cloud`
- `SAVE_CONSOLE_DEFAULT_USER=huagosr`
- `SAVE_CONSOLE_DEFAULT_OWNER=huagosr`
- `SAVE_CONSOLE_PUBLIC_BASE=/api/saves`

## 7. Verification

After deployment, verify:

1. `https://huago.cloud/saves` prompts for auth
2. login succeeds for an allowed user
3. the world list loads
4. `HuagoSurvive` appears
5. latest version and history render correctly

## 8. What This Does Not Yet Deploy

This first service slice is read-only.

It does not yet implement:

- archive upload
- direct archive download
- world creation from the UI
- role management UI

Those come in the next implementation pass.
