# Minecraft Save Console Plan

## 1. Project Goal

Extend `huago.cloud` with a protected "Minecraft save console" that allows authorized users to:

- manage multiple Minecraft worlds
- upload a world save to the server
- download the latest or historical save from the server
- view version history and metadata
- optionally bind a local folder in the browser for faster manual sync

This is intended to support a **manual sync workflow** rather than background auto-sync.

## 2. Why This Is a Separate Module

The current site is a static Astro blog deployed as generated files behind `secure-nginx`.

That setup is great for:

- content pages
- low maintenance
- simple deployment

But the new save feature needs:

- authentication
- upload endpoints
- download authorization
- world metadata storage
- version history management

So the Minecraft save console should be treated as a **small protected web app** attached to the site, not just another static content page.

## 3. Product Direction

### Core user experience

The first usable version should feel like this:

1. User opens `https://huago.cloud/saves`
2. User logs in
3. User sees a list of worlds they are allowed to access
4. User opens one world
5. User can:
   - upload the current local world as a new version
   - download the latest version
   - browse old versions
   - read size, upload time, uploader, and notes

### Important non-goals for v1

The first version should **not** try to do all of these:

- real-time sync while Minecraft is running
- OS-level folder watching
- conflict-free multi-device live merge
- mobile-first local folder sync
- full desktop app behavior inside every browser

## 4. Browser Reality Check

The idea of "choose a local save folder once, then click a web button to sync later" is only partially possible on the web.

### What is possible

On desktop Chromium browsers like Chrome and Edge, the site can use the File System Access API to:

- ask the user to choose a folder
- store a handle locally in the browser
- request permission again when needed
- read and write files in that chosen folder

### What is not guaranteed

- works the same in Safari
- works well on phones
- survives browser storage cleanup forever
- syncs the chosen folder across different devices automatically
- lets the server know the real local folder path

### Design implication

The site should treat local folder binding as an **enhanced desktop browser feature**, not the only supported path.

## 5. Recommended Architecture

### Keep the current Astro site

Keep the blog itself static.

### Add a small backend service

Add a lightweight backend dedicated to the save console. It can run separately and be reverse-proxied by nginx.

Recommended shape:

- Astro static frontend for normal site pages
- save console UI served under `/saves`
- backend API under `/api/saves/*`
- nginx reverse proxy from the public site to the API service

### Why this is the best fit

This avoids turning the whole personal site into a heavier always-on full-stack app.

## 6. Recommended Tech Direction

### Frontend

- Keep Astro for the main site
- Add one focused save console page or small route group
- Use a client-side island or small frontend component for the interactive save UI

### Backend

Recommended first choice:

- Node.js service

Why:

- fits naturally beside the current Astro and pnpm setup
- easy to deploy on the same server
- good ecosystem for auth, uploads, and zip handling

Python FastAPI would also work, but Node keeps the stack more unified.

### Storage

Use filesystem storage on the server first. No database is required for the earliest version if metadata is small.

Possible server layout:

```text
/home/huagosr/mc-cloud
  /worlds
    /huagosurvive
      world.json
      latest.json
      /versions
        huagosurvive-20260625T134731Z.zip
      /notes
  /users
  /audit
```

## 7. Auth and Access Control

This feature must not be public.

### Recommended v1 auth

Start with one of these:

1. Nginx Basic Auth in front of `/saves` and `/api/saves`
2. Application login with session cookie

For a small trusted user set, Basic Auth is the fastest path.

### Recommended permission model

Even with Basic Auth, the app should model internal roles:

- `admin`: full world and user management
- `editor`: upload and download allowed worlds
- `viewer`: download and inspect history only

Each world should also support an allow-list of users.

## 8. Multi-World Model

The app should be designed around multiple worlds from day one.

### World record

Suggested fields:

- `id`
- `slug`
- `displayName`
- `description`
- `createdAt`
- `updatedAt`
- `latestVersionId`
- `retentionCount`
- `allowedUsers`
- `tags`

### Version record

Suggested fields:

- `id`
- `worldId`
- `filename`
- `size`
- `sha256`
- `uploadedAt`
- `uploadedBy`
- `note`
- `sourceType`

`sourceType` can later distinguish:

- browser upload
- CLI upload
- manual server import

## 9. Upload and Download Design

### Recommended v1 upload path

Use versioned zip archives.

Why:

- simple
- predictable
- aligns with the prototype already working
- easier to validate and recover than many-file live sync

### Upload flow

1. User selects a world
2. User clicks upload
3. Frontend either:
   - uploads a zip the user selected manually, or
   - reads a previously authorized local folder and creates a zip client-side
4. Backend stores the uploaded zip as a new version
5. Backend computes and stores metadata
6. Backend updates `latest.json`
7. UI shows success and new version info

### Download flow

1. User selects a world
2. User chooses latest version or an older version
3. Frontend either:
   - downloads the zip directly, or
   - writes it into a previously authorized local folder

For v1, direct zip download is enough.

## 10. Recommended Rollout Phases

### Phase 1: Protected web archive

Goal: make the server-side storage and web management usable first.

Include:

- protected `/saves` entry
- world list
- world detail page
- upload zip
- download latest zip
- download historical zip
- version history
- world metadata display

Do not include yet:

- browser local folder binding
- in-browser unzip write-back
- rich admin management UI

### Phase 2: Desktop browser local sync

Goal: make the browser workflow smoother on desktop.

Include:

- choose local world folder
- store browser-local folder handle
- one-click "upload local world"
- one-click "write latest cloud version to local folder"
- permission re-check and recovery UI

### Phase 3: Quality and safety

Include:

- operation logs
- restore from version UI
- version notes
- stale lock handling if reusing lock logic
- file size and hash verification UX
- better conflict messaging

## 11. Route Proposal

### Public routes

- `/`
- `/blog`
- `/about`

### Protected save routes

- `/saves`
- `/saves/worlds/:slug`
- `/saves/worlds/:slug/history`
- `/saves/worlds/:slug/settings`

### API routes

- `GET /api/saves/worlds`
- `POST /api/saves/worlds`
- `GET /api/saves/worlds/:slug`
- `GET /api/saves/worlds/:slug/versions`
- `POST /api/saves/worlds/:slug/upload`
- `GET /api/saves/worlds/:slug/download/latest`
- `GET /api/saves/worlds/:slug/download/:versionId`
- `PATCH /api/saves/worlds/:slug`
- `GET /api/saves/me`

## 12. UI Proposal

### Saves home

Show:

- title and short explanation
- list of worlds
- latest sync time
- latest version size
- quick actions

### World detail

Show:

- world title and description
- latest version card
- upload button
- download latest button
- version history list
- optional local folder status

### World settings

Show:

- retention count
- access list
- optional notes
- dangerous actions hidden behind confirmation

## 13. Operational Considerations

### File size

Minecraft worlds can be large. Upload limits and nginx proxy settings must be increased for this feature.

### Backups

The save archive area should not live only inside the website deploy directory. It should remain separate from the blog build output.

### Deployment separation

Do not mix:

- website static files in `/home/huagosr/my_website/html`
- save archive data in `/home/huagosr/mc-cloud`

### Auditing

It is worth keeping a small append-only log of:

- who uploaded
- who downloaded
- when
- which world
- which version

## 14. Security Notes

- Never expose raw upload endpoints without auth
- Validate world slug inputs carefully
- Never trust client file names alone
- Avoid allowing arbitrary path writes on the server
- Limit upload target locations to configured world directories
- Consider signed download responses or session-checked downloads

## 15. Recommended First Implementation Scope

If implementation starts now, the best first delivery is:

1. a protected `/saves` area
2. world list and world detail page
3. manual zip upload
4. manual zip download
5. metadata and version history

That version is already useful, stable, and much easier to ship than full browser-folder sync.

## 16. Open Questions

Before implementation, these should be decided explicitly:

1. Should login start with Basic Auth or app sessions?
2. Should uploads be allowed for all authorized users or only editors?
3. Should v1 support only your own account, or multiple named accounts?
4. Should version retention be global or per world?
5. Should old versions ever be deletable from the UI?
6. Do you want the save console linked from the public navigation, or reachable only by direct URL?

## 17. Current Recommendation

Proceed in this order:

1. Build the protected archive-style web app first
2. Keep the main blog static
3. Add browser local folder sync only after the archive flow is solid

That gives you the best tradeoff between usefulness, safety, and implementation complexity.
