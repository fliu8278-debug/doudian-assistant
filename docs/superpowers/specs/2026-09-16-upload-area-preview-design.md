# Upload-area video preview

## Goal

Make the source-video area match the approved compact layout: it is an upload target before selection and the source-video preview after selection.

## Behaviour

- Before a video is selected, show the existing dashed MP4 upload target.
- After selection, replace that target in the same card position with the native video player.
- Keep a small “更换视频” control in the player so a user can select a different MP4.
- Keep the right-side output card, processing progress and download action unchanged.
- Remove the separate source-file row and source metadata grid. They duplicate information and make the panel taller.

## Scope and verification

Only the source-side React markup, styles and focused rendering tests change. No server, processing, download or updater behaviour changes.

Verify the initial upload state and the selected-video state with the existing Vitest suite, then run TypeScript checking and the production build.
