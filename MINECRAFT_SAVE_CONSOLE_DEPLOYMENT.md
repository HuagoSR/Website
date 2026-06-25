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

Because the current `secure-nginx` container mounts only:

- `/home/huagosr/my_website/conf/default.conf` -> `/etc/nginx/conf.d/default.conf`
- `/home/huagosr/my_website/html` -> `/usr/share/nginx/html`

the simplest password file location is inside the mounted site directory:

- `/home/huagosr/my_website/html/.htpasswd_saves`

Create an htpasswd-style file on the server, for example:

```bash
python3 - <<'PY'
import crypt
from pathlib import Path

password = "your-password-here"
hashed = crypt.crypt(password, crypt.mksalt(crypt.METHOD_SHA512))
Path("/home/huagosr/my_website/html/.htpasswd_saves").write_text(
    f"huagosr:{hashed}\n",
    encoding="utf-8",
    newline="\n",
)
PY
```

Add additional users later with:

```bash
python3 - <<'PY'
import crypt
from pathlib import Path

password = "another-password"
hashed = crypt.crypt(password, crypt.mksalt(crypt.METHOD_SHA512))
with Path("/home/huagosr/my_website/html/.htpasswd_saves").open("a", encoding="utf-8", newline="\n") as f:
    f.write(f"friend_a:{hashed}\n")
PY
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

## 5. API Runtime

The current server does **not** have Node installed on the host OS, but it does have Docker.

That makes a small dedicated Node container the cleanest deployment path for now.

Recommended deployment flow:

1. copy the `save-console-api` folder to `/home/huagosr/my_website/save-console-api`
2. create a shared Docker network such as `website-internal`
3. pull `node:22-alpine`
4. run the API container with:
   - code mounted read-only
   - `/home/huagosr/mc-cloud` mounted read-write
   - attachment to the same Docker network as `secure-nginx`
5. point nginx at `http://minecraft-save-console:4312`
6. reload nginx

Example:

```bash
docker network create website-internal || true
docker network connect website-internal secure-nginx || true

docker pull node:22-alpine

docker rm -f minecraft-save-console || true

docker run -d \
  --name minecraft-save-console \
  --restart unless-stopped \
  --network website-internal \
  -e SAVE_CONSOLE_HOST=0.0.0.0 \
  -e SAVE_CONSOLE_PORT=4312 \
  -e SAVE_CONSOLE_DATA_ROOT=/data \
  -e SAVE_CONSOLE_DEFAULT_USER=huagosr \
  -e SAVE_CONSOLE_DEFAULT_OWNER=huagosr \
  -e SAVE_CONSOLE_PUBLIC_BASE=/api/saves \
  -v /home/huagosr/my_website/save-console-api:/app:ro \
  -v /home/huagosr/mc-cloud:/data \
  -w /app \
  node:22-alpine \
  node src/server.mjs
```

## 6. Environment

The container currently expects:

- `SAVE_CONSOLE_HOST=0.0.0.0`
- `SAVE_CONSOLE_PORT=4312`
- `SAVE_CONSOLE_DATA_ROOT=/data`
- `SAVE_CONSOLE_DEFAULT_USER=huagosr`
- `SAVE_CONSOLE_DEFAULT_OWNER=huagosr`
- `SAVE_CONSOLE_PUBLIC_BASE=/api/saves`

## 7. Verification

After deployment, verify:

1. `https://huago.cloud/saves` prompts for auth
2. login succeeds with Basic Auth
3. the world list loads
4. `HuagoSurvive` appears
5. latest version and history render correctly

## 8. What This Does Not Yet Deploy

This service slice now includes:

- world list
- world detail
- version history
- manual zip upload
- latest version download
- historical version download

It does not yet implement:

- world creation from the UI
- role management UI

Those come in the next implementation pass.
