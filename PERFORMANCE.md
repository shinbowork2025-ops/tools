# Performance architecture

## Loading stages

1. The home screen loads only the common shell and enhances tool cards after HTML parsing.
2. Each tool loads only its own HTML, CSS, and JavaScript.
3. Pesticide search starts with the 55 garden products in `garden-data.js`.
4. The 29 MB full pesticide source is loaded only after the user enables full search.
5. Full-data parsing and indexing run in `full-data-worker.js`; the UI receives metadata first and only the rows for a selected product or crop afterward.

The full-data switch no longer reloads the page. This keeps current UI state, avoids evaluating the largest source on the main thread, and avoids retaining every registration row in both the data layer and the rendered page.

## Rendering and caching

- Long result/card lists use `content-visibility: auto` so off-screen cards do not participate in initial layout and paint.
- Service Worker navigation preload starts the document request while the worker boots.
- Explicit offline saves fetch up to four independent assets concurrently and keep progress reporting intact.
- The full pesticide source remains an explicit optional offline asset; normal tool caching does not download it.

## Verification

```bash
npm run check
npm run test:pesticide-worker
node scripts/check-js.mjs
node scripts/check-pwa.mjs
```

The Worker test evaluates the real full-data source, builds its product and crop indexes, and verifies that product/crop queries return only their requested rows.
