# Monorepo backend for train status

## Status

Accepted

## Context

The dashboard needs route-level train operation status for lines that are not consistently covered by a suitable free API. Browser-only scraping is not appropriate because of CORS, parsing stability, and the need to keep scraping frequency under backend control.

## Decision

Move the project to a pnpm workspace monorepo:

- `apps/web`: Vite + React SPA
- `apps/api`: Hono API server on Node.js
- `packages/shared`: shared response types and watched line configuration

The API server fetches Yahoo! Transit operation status pages, parses them with Cheerio, caches the normalized response for a short TTL, and exposes `GET /api/train-status`. The web app calls only the backend endpoint through the Vite `/api` proxy.

Initial watched lines:

- 京王線
- 中央線
- 総武線
- 多摩モノレール

小田急線 and 京王相模原線 are intentionally not included in this phase.

## Consequences

- Frontend remains focused on rendering and TanStack Query state.
- Scraping details and rate control are isolated in the backend.
- Yahoo page structure changes will break the parser explicitly instead of showing fabricated data.
- The project now requires both `apps/api` and `apps/web` during local development.
