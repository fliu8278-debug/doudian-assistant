# Mirrored release assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish each Windows release to both the auto-update repository and the source repository without changing the existing updater feed.

**Architecture:** Keep Electron Builder's publish target set to `doudian-assistant-releases`. Extend the tag workflow after canonical publishing: download the three canonical assets, create a draft release in `doudian-assistant`, upload those files, then publish the mirror release.

**Tech Stack:** GitHub Actions, GitHub CLI, Electron Builder, npm, Vitest.

---

### Task 1: Mirror canonical assets in the release workflow

**Files:**
- Modify: `.github/workflows/release.yml:49-51`

- [ ] **Step 1: Add a source-release mirror step after canonical publishing**

Add this PowerShell action after `Publish completed release`:

```yaml
      - name: Mirror release to source repository
        shell: pwsh
        run: |
          $mirror = 'fliu8278-debug/doudian-assistant'
          $source = 'fliu8278-debug/doudian-assistant-releases'
          $assets = Join-Path $env:RUNNER_TEMP 'release-assets'
          New-Item -ItemType Directory -Force -Path $assets | Out-Null
          gh release create "$env:GITHUB_REF_NAME" --repo $mirror --draft --title "抖店助手 $env:GITHUB_REF_NAME" --notes-file release-notes.md
          gh release download "$env:GITHUB_REF_NAME" --repo $source --dir $assets --pattern '*.exe' --pattern '*.blockmap' --pattern 'latest.yml'
          gh release upload "$env:GITHUB_REF_NAME" "$assets/*" --repo $mirror
          gh release edit "$env:GITHUB_REF_NAME" --repo $mirror --draft=false --latest
```

- [ ] **Step 2: Review workflow syntax and release ordering**

Run `Get-Content .github/workflows/release.yml`. The mirror step must appear after canonical publication, use `$env:GITHUB_REF_NAME` for both tags, and leave the existing `release:win` target unchanged.

- [ ] **Step 3: Commit the workflow update**

Run `git add .github/workflows/release.yml` then `git commit -m "ci: mirror release assets to source repo"`.

### Task 2: Publish and verify a mirrored release

**Files:**
- Modify: `package.json:3`
- Modify: `package-lock.json:3,9`
- Modify: `CHANGELOG.md:3`

- [ ] **Step 1: Bump the application version to `0.1.8`**

Set the package and lockfile version values to `0.1.8`. Add this release note before the `0.1.7` section:

```md
## [0.1.8]

- 安装包同步发布到主项目仓库的 Releases 页面，方便直接下载。
- 保留原自动更新发布仓库，已安装用户可继续正常接收更新。
```

- [ ] **Step 2: Run local verification before tag creation**

Run `npm test; npm run typecheck; npm run build; git diff --check`. Expect all Vitest files to pass, TypeScript and production build to exit 0, and no whitespace errors.

- [ ] **Step 3: Commit, push and tag the release**

Run `git add package.json package-lock.json CHANGELOG.md .github/workflows/release.yml`, `git commit -m "release: v0.1.8"`, `git push origin main`, `git tag v0.1.8`, then `git push origin v0.1.8`.

- [ ] **Step 4: Verify both public releases**

Query both `fliu8278-debug/doudian-assistant-releases` and `fliu8278-debug/doudian-assistant` for `v0.1.8`. Each result must be non-draft and non-prerelease, have the same title and Chinese notes, and include `doudian-tool-setup-0.1.8.exe`, `doudian-tool-setup-0.1.8.exe.blockmap`, and `latest.yml`.
