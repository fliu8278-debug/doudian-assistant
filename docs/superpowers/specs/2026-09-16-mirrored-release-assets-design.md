# Mirrored release assets

## Goal

Show each Windows installer on the source repository's Releases page while preserving the existing dedicated release repository as the Electron auto-update source.

## Behaviour

- The existing `doudian-assistant-releases` release remains the canonical auto-update feed.
- On every version tag, the release workflow publishes the installer, blockmap and `latest.yml` there as it does today.
- After that publish, the workflow creates a release with the same tag, title and Chinese release notes in `doudian-assistant`.
- The workflow downloads the three uploaded assets from the canonical release and uploads the identical files to the source-repository release.
- The source repository release is published only after all three files have been copied.

## Compatibility

No Electron publish configuration or updater release URL changes. Existing installed versions continue to discover updates through `doudian-assistant-releases`; users browsing the source repository gain a visible installer download.

## Verification

Use a new version tag to run the workflow, then verify that both repositories expose a non-draft release with the same installer, blockmap, `latest.yml`, title and notes.
