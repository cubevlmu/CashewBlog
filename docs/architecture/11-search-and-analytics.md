# Search and Analytics

## Search

The target is title + body + tags with relevance-first ranking and highlighted results, without requiring Meilisearch/Typesense.

### PostgreSQL approach

For multilingual/CJK-friendly v1 behavior, prefer a combination of:

- normalized `SearchText` generated from Markdown plain text + title + tags
- `pg_trgm` similarity indexes for title/search text
- `ILIKE`/trigram candidate matching
- optional PostgreSQL full-text vectors for Latin-language tokenized content if useful

Do not rely solely on default English `tsvector` behavior for Chinese text.

Implementation can rank with weighted components, e.g.:

1. exact/prefix title match
2. title trigram similarity
3. tag match
4. body/search-text similarity
5. published recency only as a minor tie-breaker

### Highlighting

Return safe snippets. Escape source content and search terms before adding `<mark>` or return structured highlight spans.

Only Published posts are searchable anonymously.

## View counting

A page view increments a public post at most once per anonymous visitor hash per 30-minute window.

Suggested visitor material:

- normalized IP prefix or IP
- User-Agent
- server-side secret/pepper

Hash it; do not persist raw IP solely for this feature.

Store:

- `Posts.ViewCount` total counter
- `PostDailyStats` daily aggregates
- `PostViewDedupe` short-lived dedupe keys

Private/Draft views are not counted.

## Dashboard analytics

Required:

- total PV
- today PV
- 7-day trend
- 30-day trend
- Top 10 posts
- per-post totals

No need for a general event analytics platform in CashewBlog DB. Umami remains optional for richer independent analytics.

## Dedupe cleanup

Periodically delete `PostViewDedupe` rows where `ExpiresAt < now`.
