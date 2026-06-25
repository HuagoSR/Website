# Minecraft Save Console Phase 1 Tasks

## 1. Phase 1 Goal

Ship a protected web archive for Minecraft worlds with:

- login protection
- multi-world support
- version history
- manual zip upload
- manual zip download

This phase does **not** include browser local folder binding.

## 2. Definition of Done

Phase 1 is done when:

1. only authorized users can reach the save console
2. the console lists at least one world
3. a user can upload a zip archive for a world
4. the app records the new version metadata
5. a user can download latest and historical versions
6. the UI shows version history clearly
7. uploads land under `/home/huagosr/mc-cloud`
8. the main blog deployment still works normally

## 3. Workstreams

### A. Infrastructure

- Decide whether v1 auth is Basic Auth or app sessions
- Add nginx routing for `/saves` and `/api/saves`
- Decide backend runtime location on the server
- Decide process manager for backend if needed
- Set upload size limits in nginx
- Ensure backend can read/write `/home/huagosr/mc-cloud`

### B. Backend Foundation

- Create backend app skeleton
- Add config loading
- Add auth context extraction
- Add structured error responses
- Add filesystem storage helpers
- Add audit log helper

### C. World Data Layer

- Implement world list read
- Implement world detail read
- Implement version list read
- Implement latest version read
- Implement world creation helper for admin use

### D. Upload Flow

- Accept `multipart/form-data`
- Validate zip file and file size
- Write temporary upload file
- Compute SHA-256 and size
- Move archive into final world directory
- Update `versions.json`
- Update `latest.json`
- Write audit event

### E. Download Flow

- Stream latest version download
- Stream historical version download
- Check world access before file response
- Return clear errors for missing versions

### F. Frontend UI

- Add protected `/saves` page shell
- Add world list page
- Add world detail page
- Add upload form
- Add latest download button
- Add version history table or list
- Add error and success state messaging

### G. Operations

- Document server setup
- Document deploy steps
- Test upload with a real save zip
- Test download from a second browser session
- Verify blog deployment is unaffected

## 4. Recommended Task Order

1. Decide auth approach
2. Add backend skeleton
3. Add world read endpoints
4. Add upload endpoint
5. Add download endpoints
6. Add minimal UI
7. Add nginx routing and upload limit config
8. Run real end-to-end testing

## 5. Suggested Milestones

### Milestone 1: Read-only console

Deliver:

- auth gate
- world list
- world detail
- version history display

### Milestone 2: Upload works

Deliver:

- zip upload
- metadata update
- audit append

### Milestone 3: Download works

Deliver:

- latest download
- historical download
- end-to-end smoke test

## 6. Risks

### Large archive uploads

Risk:

- default nginx and app limits may reject uploads

Mitigation:

- explicitly configure upload size limits before testing with real worlds

### Partial metadata updates

Risk:

- version file uploaded but `latest.json` not updated

Mitigation:

- use temp files and ordered writes
- log failures with enough detail to recover manually

### Unauthorized world access

Risk:

- one authenticated user sees worlds they should not

Mitigation:

- centralize access checks in backend helpers

### Deployment complexity

Risk:

- backend service complicates the current simple static deploy flow

Mitigation:

- keep service scope narrow
- document run and restart steps clearly

## 7. Testing Checklist

- unauthorized request is rejected
- world list is correct for current user
- upload of valid zip succeeds
- upload of invalid file type fails
- latest metadata updates after upload
- latest download returns the newest zip
- historical download returns the requested zip
- second world remains isolated from the first
- audit log gets new entries

## 8. Recommended First Demo Scenario

Use one real world:

- `HuagoSurvive`

Demo flow:

1. open the saves console
2. view `HuagoSurvive`
3. upload a new save zip
4. verify history updated
5. download the latest zip

If that flow feels solid, Phase 1 is on track.
