# Minecraft Save Console API Draft

## 1. Purpose

This document defines the first practical API shape for the Minecraft save console.

The goal is to support:

- protected access
- multi-world listing
- manual zip upload
- latest and historical download
- world metadata inspection
- version history browsing

This draft is intentionally simple and filesystem-friendly.

Current implementation status:

- `GET /api/saves/me`: implemented
- `GET /api/saves/worlds`: implemented
- `GET /api/saves/worlds/:slug`: implemented
- `GET /api/saves/worlds/:slug/versions`: implemented
- `POST /api/saves/worlds/:slug/upload`: implemented with raw zip body upload
- `GET /api/saves/worlds/:slug/download/latest`: implemented
- `GET /api/saves/worlds/:slug/download/:versionId`: implemented

## 2. API Style

- Base path: `/api/saves`
- Response format: JSON unless downloading a file
- Auth: protected by nginx auth first, then trusted user identity passed to the app
- Time format: ISO 8601 UTC strings
- IDs: stable string IDs

## 3. Common Response Shapes

### Success envelope

```json
{
  "ok": true,
  "data": {}
}
```

### Error envelope

```json
{
  "ok": false,
  "error": {
    "code": "world_not_found",
    "message": "The requested world does not exist."
  }
}
```

## 4. Auth Context

The backend should resolve a current user for each request.

Suggested user context:

```json
{
  "id": "huagosr",
  "displayName": "HuagoSR",
  "role": "admin"
}
```

For a Basic Auth first version, this can be mapped from the authenticated username.

## 5. Endpoints

### `GET /api/saves/me`

Purpose:

- return the resolved current user and high-level permissions

Response:

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "huagosr",
      "displayName": "HuagoSR",
      "role": "admin"
    },
    "capabilities": {
      "canCreateWorld": true
    }
  }
}
```

### `GET /api/saves/worlds`

Purpose:

- list all worlds visible to the current user

Query parameters:

- `includeLatest=true|false`

Response:

```json
{
  "ok": true,
  "data": {
    "worlds": [
      {
        "id": "world_huagosurvive",
        "slug": "huagosurvive",
        "displayName": "HuagoSurvive",
        "description": "Main survival world",
        "updatedAt": "2026-06-25T13:49:39Z",
        "latestVersion": {
          "id": "ver_20260625T134731Z",
          "filename": "HuagoSurvive-20260625T134731Z.zip",
          "size": 1125096516,
          "uploadedAt": "2026-06-25T13:49:39Z",
          "uploadedBy": "huagosr"
        }
      }
    ]
  }
}
```

### `POST /api/saves/worlds`

Purpose:

- create a new world entry

Allowed role:

- `admin`

Request body:

```json
{
  "slug": "huagosurvive",
  "displayName": "HuagoSurvive",
  "description": "Main survival world",
  "retentionCount": 20,
  "allowedUsers": ["huagosr"]
}
```

Response:

- `201 Created`

### `GET /api/saves/worlds/:slug`

Purpose:

- fetch one world and its latest version summary

Response:

```json
{
  "ok": true,
  "data": {
    "world": {
      "id": "world_huagosurvive",
      "slug": "huagosurvive",
      "displayName": "HuagoSurvive",
      "description": "Main survival world",
      "retentionCount": 20,
      "allowedUsers": ["huagosr"],
      "createdAt": "2026-06-25T13:40:00Z",
      "updatedAt": "2026-06-25T13:49:39Z",
      "latestVersionId": "ver_20260625T134731Z"
    },
    "latestVersion": {
      "id": "ver_20260625T134731Z",
      "filename": "HuagoSurvive-20260625T134731Z.zip",
      "size": 1125096516,
      "sha256": "5c074c241071c04987afd463e5fd1f1a3b8f046bb78897face81e8685fedc42a",
      "uploadedAt": "2026-06-25T13:49:39Z",
      "uploadedBy": "huagosr",
      "note": ""
    }
  }
}
```

### `PATCH /api/saves/worlds/:slug`

Purpose:

- update editable world metadata

Allowed role:

- `admin`

Request body:

```json
{
  "displayName": "HuagoSurvive",
  "description": "Main survival world",
  "retentionCount": 20,
  "allowedUsers": ["huagosr", "friend_a"]
}
```

### `GET /api/saves/worlds/:slug/versions`

Purpose:

- list version history for one world

Query parameters:

- `limit`
- `cursor`

Response:

```json
{
  "ok": true,
  "data": {
    "versions": [
      {
        "id": "ver_20260625T134731Z",
        "filename": "HuagoSurvive-20260625T134731Z.zip",
        "size": 1125096516,
        "sha256": "5c074c241071c04987afd463e5fd1f1a3b8f046bb78897face81e8685fedc42a",
        "uploadedAt": "2026-06-25T13:49:39Z",
        "uploadedBy": "huagosr",
        "note": "",
        "sourceType": "browser-upload"
      }
    ],
    "nextCursor": null
  }
}
```

### `POST /api/saves/worlds/:slug/upload`

Purpose:

- upload a new version archive for a world

Allowed roles:

- `admin`
- `editor`

Request type:

- raw request body

Required headers:

- `Content-Type: application/zip` or `application/octet-stream`
- `X-Save-Filename: <name>.zip`

Optional headers:

- `X-Save-Note: <free text>`

Behavior:

- validate world access
- validate file extension and size
- write upload to a temporary path
- compute hash
- assign version ID
- move file into `versions/`
- append version metadata
- update `latest.json`
- append audit entry
- prune old versions if needed

Response:

```json
{
  "ok": true,
  "data": {
    "version": {
      "id": "ver_20260626T020000Z",
      "filename": "HuagoSurvive-20260626T020000Z.zip",
      "size": 1126000000,
      "sha256": "abcdef...",
      "uploadedAt": "2026-06-26T02:00:00Z",
      "uploadedBy": "huagosr",
      "note": "Before new base build",
      "sourceType": "browser-upload"
    }
  }
}
```

### `GET /api/saves/worlds/:slug/download/latest`

Purpose:

- stream the latest version zip

Allowed roles:

- `admin`
- `editor`
- `viewer`

Response:

- `200 OK`
- `Content-Type: application/zip`
- `Content-Disposition: attachment`

### `GET /api/saves/worlds/:slug/download/:versionId`

Purpose:

- stream a specific historical zip

### `GET /api/saves/worlds/:slug/audit`

Purpose:

- list upload and download events for a world

Allowed role:

- `admin`

This endpoint can be optional in v1 if the UI does not expose audit history yet.

## 6. Error Codes

Suggested codes:

- `unauthorized`
- `forbidden`
- `world_not_found`
- `version_not_found`
- `invalid_slug`
- `invalid_archive`
- `upload_too_large`
- `world_already_exists`
- `storage_write_failed`
- `internal_error`

## 7. Validation Rules

### World slug

- lowercase letters, numbers, `-`, `_`
- no spaces
- no path separators

### Upload archive

- must end in `.zip`
- must stay under configured maximum size
- must not write outside the world storage directory

### Notes

- length-limited
- plain text only in v1

## 8. Versioning Notes

The API should not promise stable pagination or sorting semantics beyond:

- versions sorted newest first
- world list sorted by `updatedAt` descending

## 9. First Implementation Recommendation

If build scope needs trimming, implement only:

- `GET /api/saves/me`
- `GET /api/saves/worlds`
- `GET /api/saves/worlds/:slug`
- `GET /api/saves/worlds/:slug/versions`
- `POST /api/saves/worlds/:slug/upload`
- `GET /api/saves/worlds/:slug/download/latest`
- `GET /api/saves/worlds/:slug/download/:versionId`

That set is enough to support a strong v1 UI.
