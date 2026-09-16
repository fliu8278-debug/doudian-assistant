# Friends Update Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Windows Electron app to the existing public release repository without requiring a Windows signing certificate, for distribution to trusted friends.

**Architecture:** Keep the existing public GitHub Release repository and the in-app updater UI. Electron's Authenticode verification is explicitly disabled because no certificate exists; the GitHub Actions workflow still creates a draft release, uploads assets, and publishes only after the build completes.

**Tech Stack:** Electron, electron-builder, electron-updater, GitHub Actions, Vitest.

---

### Task 1: Allow unsigned updater packages

**Files:**
- Modify: `electron/updater.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing configuration test**

```ts
expect(packageJson.build.win.verifyUpdateCodeSignature).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- electron/updater.test.ts`

Expected: the configuration assertion reports `true` instead of `false`.

- [ ] **Step 3: Disable only Electron's Authenticode update check**

```json
"win": {
  "target": ["nsis"],
  "verifyUpdateCodeSignature": false
}
```

- [ ] **Step 4: Re-run the focused test**

Run: `npm test -- electron/updater.test.ts`

Expected: 6 tests pass.

### Task 2: Remove unavailable certificate secrets from publishing

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `docs/release.md`

- [ ] **Step 1: Keep only the existing release token requirement**

```powershell
$missing = 'GH_TOKEN' | Where-Object {
  [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
}
```

- [ ] **Step 2: Remove certificate-only environment variables**

```yaml
env:
  GH_TOKEN: ${{ secrets.GH_RELEASE_TOKEN }}
```

- [ ] **Step 3: Document the trusted-friends limitation**

State that `GH_RELEASE_TOKEN` is required and Windows may show an unknown-publisher prompt because the package is deliberately unsigned.

### Task 3: Verify and publish the release configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Increase the application version to `0.1.2`**

Run: `npm version 0.1.2 --no-git-tag-version`

- [ ] **Step 2: Run full verification**

Run: `npm test; npm run build; npm run dist:win`

Expected: all commands exit with code 0 and an NSIS installer exists in `release`.

- [ ] **Step 3: Commit and push the release configuration**

Run: `git add package.json package-lock.json electron/updater.test.ts .github/workflows/release.yml docs/release.md docs/superpowers/plans/2026-09-16-friends-update-release.md && git commit -m "build: allow unsigned friend update releases" && git push origin main`

- [ ] **Step 4: Create and push tag `v0.1.2`**

Run: `git tag v0.1.2 && git push origin v0.1.2`

Expected: the GitHub Actions release workflow starts and publishes the installer plus `latest.yml` to the public release repository.
