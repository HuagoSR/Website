# Minecraft Save Console Data Model

## 1. Goal

This document defines the recommended filesystem-backed data model for the first implementation.

The design assumes:

- no database in v1
- low user count
- moderate world count
- versioned zip archives as the storage format

## 2. Storage Root

Recommended root:

```text
/home/huagosr/mc-cloud
```

Top-level layout:

```text
/home/huagosr/mc-cloud
  /worlds
  /users
  /audit
  /tmp
```

## 3. World Directory Layout

Each world should live in its own slugged directory.

Example:

```text
/home/huagosr/mc-cloud/worlds/huagosurvive
  world.json
  latest.json
  versions.json
  /versions
    HuagoSurvive-20260625T134731Z.zip
  /uploads
  /tmp
```

## 4. Files

### `world.json`

Purpose:

- stable metadata for the world

Suggested shape:

```json
{
  "id": "world_huagosurvive",
  "slug": "huagosurvive",
  "displayName": "HuagoSurvive",
  "description": "Main survival world",
  "createdAt": "2026-06-25T13:40:00Z",
  "updatedAt": "2026-06-25T13:49:39Z",
  "retentionCount": 20,
  "allowedUsers": ["huagosr"],
  "tags": ["survival"]
}
```

### `latest.json`

Purpose:

- quick lookup for the newest good version

Suggested shape:

```json
{
  "worldId": "world_huagosurvive",
  "versionId": "ver_20260625T134731Z",
  "filename": "HuagoSurvive-20260625T134731Z.zip",
  "size": 1125096516,
  "sha256": "5c074c241071c04987afd463e5fd1f1a3b8f046bb78897face81e8685fedc42a",
  "uploadedAt": "2026-06-25T13:49:39Z",
  "uploadedBy": "huagosr",
  "note": "",
  "sourceType": "browser-upload"
}
```

### `versions.json`

Purpose:

- history index for the world

Suggested shape:

```json
{
  "worldId": "world_huagosurvive",
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
  ]
}
```

For a very small number of versions, one JSON index per world is fine.

## 5. Optional Global Files

### `/users/users.json`

Purpose:

- map usernames to display info and roles

Suggested shape:

```json
{
  "users": [
    {
      "id": "huagosr",
      "displayName": "HuagoSR",
      "role": "admin",
      "enabled": true
    }
  ]
}
```

### `/audit/audit.log`

Purpose:

- append-only audit trail

Suggested line format:

```json
{"ts":"2026-06-25T13:49:39Z","user":"huagosr","action":"upload","world":"huagosurvive","versionId":"ver_20260625T134731Z"}
```

JSON lines are easier than one large JSON array.

## 6. Naming Rules

### World slug

- lowercase
- no spaces
- no path traversal
- stable once created

### Version ID

Recommended format:

```text
ver_YYYYMMDDTHHMMSSZ
```

### Archive filename

Recommended format:

```text
<DisplayName or slug>-YYYYMMDDTHHMMSSZ.zip
```

## 7. Write Strategy

To avoid partial writes:

1. upload to a temp path
2. compute hash and size
3. move archive into final `versions/` location
4. update `versions.json`
5. update `latest.json`
6. append audit entry

This ordering matters. `latest.json` should be updated only after the archive is safely stored.

## 8. Retention Strategy

Each world should carry its own `retentionCount`.

Recommended v1 behavior:

- keep newest `N` versions
- delete older archive files after metadata update
- append deletions to the audit log

Safer alternative:

- keep all versions in v1
- add cleanup later

That is simpler if storage pressure is low.

## 9. Why Filesystem First

This is a good fit because:

- you already store save archives on disk
- world count is small
- metadata writes are low frequency
- recovery is easy to inspect manually

The design can be migrated later into SQLite or Postgres if needed.

## 10. Future Migration Path

If the app grows, migrate these structures:

- `world.json` -> `worlds` table
- `versions.json` -> `versions` table
- `users.json` -> `users` table
- `audit.log` -> `audit_events` table

The archive files themselves can still remain on disk.
