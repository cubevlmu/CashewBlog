# Media Storage

## Storage layout

Default persistent mount: `/uploads`.

Human-readable date partitioning is preferred:

```text
/uploads/
└─ 2026/
   └─ 09/
      ├─ 019...-original.png
      ├─ 019...-display.webp
      ├─ 019...-thumb-384.webp
      └─ 019...-document.zip
```

Use generated IDs in names to avoid collisions; keep original filename in the database.

## Image pipeline

On image upload:

1. validate file is actually a decodable image when declared as image
2. persist original
3. read dimensions
4. enforce configurable maximum pixel dimensions if desired
5. generate optimized WebP display version
6. generate thumbnail(s)
7. persist metadata row

Do not strip the original automatically.

## Attachments

Administrator may upload arbitrary file types. Still apply:

- maximum request/file size
- generated safe storage filenames
- content-disposition for attachments where appropriate
- path traversal prevention
- never execute files from the uploads path as server code

## URLs

Public media URLs should be stable. Example:

`/uploads/2026/09/<generated-name>.webp`

The admin API returns canonical URL(s); the editor should not construct paths itself.

## References

Every system-managed reference should be recorded so deletion can be blocked safely:

- post cover
- Markdown body image/attachment
- Custom Page image/file reference where parser can identify it
- profile avatar
- banner
- favicon/logo if managed by library

For freeform HTML/CSS settings, reference extraction will not always be perfect. Prefer media picker insertion with canonical asset IDs/URLs and periodically reconcile references.

## Delete behavior

`DELETE /api/admin/media/{id}`:

- no references => delete generated variants + original + DB row
- referenced => `409 Conflict`, return referencing objects

Do not silently break articles.
