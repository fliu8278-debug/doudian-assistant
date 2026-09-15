# Doudian Tool Design

## Goal

Build a local shop-management tool for Doudian coupon workflows. The first usable slice covers shop list management, persistent browser profile paths, spreadsheet-backed fan coupon tasks, and a minimal workbench UI.

## Boundaries

- The tool does not save readable cookies, passwords, OTPs, or account secrets.
- Each shop owns a local browser profile directory. Login persistence comes from that browser environment.
- Captcha, SMS, face verification, and final coupon submission stay manual.
- First version focuses on structure, shop list UI, local database, and task records.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, TypeScript, Express
- Database: SQLite through Node 24 `node:sqlite`
- Browser automation: Playwright, isolated under `src/rpa`
- Spreadsheet import: choose during the import slice; `xlsx` is avoided because current npm audit reports unresolved high-severity advisories.

## Main Modules

- `src/app`: user interface
- `src/server`: local HTTP API
- `src/db`: SQLite schema and repositories
- `src/imports`: spreadsheet parsing and row validation
- `src/rpa`: Doudian browser automation
- `src/shared`: shared types and constants

## Data Model

- `shops`: store shop names, account labels, status, and current-shop flag
- `browser_profiles`: store one profile path per shop
- `coupon_batches`: store imported spreadsheet batches
- `coupon_tasks`: store one coupon row per task
- `task_logs`: store execution logs
- `settings`: store local key-value settings
