# Ragie API Reference

Quick reference for working with the Ragie API in PropertyLens.

## Authentication

```
Authorization: Bearer <api_key>
Base URL: https://api.ragie.ai
```

## Documents API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents` | Upload file |
| POST | `/documents/raw` | Ingest raw text |
| POST | `/documents/url` | Ingest from URL |
| GET | `/documents` | List documents (paginated, max 100) |
| GET | `/documents/{id}` | Get document details |
| DELETE | `/documents/{id}` | Delete document |
| GET | `/documents/{id}/chunks` | Get document chunks |
| GET | `/documents/{id}/content` | Get content |
| GET | `/documents/{id}/summary` | Get LLM summary |

### Document States

```
pending → partitioning → partitioned → refined → chunked → indexed → summary_indexed → keyword_indexed → ready
```

- Retrieval available at `ready` (optionally `indexed`)
- Summary available at `summary_indexed` or `ready`

### Supported Formats

- **Audio**: MP3, WAV, M4A, OGG, AAC, FLAC
- **Video**: MP4, WebM, MOV, AVI, FLV, MKV, MPEG, WMV, 3GPP
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, CSV, JSON, images

## Retrievals API

### Endpoint

```
POST https://api.ragie.ai/retrievals
```

### Request Parameters

```typescript
{
  query: string;              // Search query
  partition?: string;         // Target partition (default: "default")
  filter?: object;            // Metadata filter
  top_k?: number;             // Number of chunks to return
  rerank?: boolean;           // Enable reranking
  max_chunks_per_document?: number;
  semantic_weight?: number;
  keyword_weight?: number;
}
```

### Response

Returns scored chunks with:
- `chunk_id`
- `text` - Content
- `score` - Relevance score
- `document_id`
- `document_metadata`

## Responses API (Generations)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/responses` | Generate grounded response |
| GET | `/responses/{id}` | Get existing response |

### Request

```typescript
{
  query: string;
  model: "deep-search";       // Only model available
  stream?: boolean;
  partition?: string;
}
```

## Metadata Filters

### Default Document Metadata

Every document includes:
- `document_id`
- `document_type` (pdf, doc, img, etc.)
- `document_source` (api, google_drive)
- `document_name`
- `document_uploaded_at` (Unix timestamp)

### Filter Operators

| Operator | Description |
|----------|-------------|
| `$eq` | Equal to |
| `$ne` | Not equal to |
| `$gt` | Greater than |
| `$gte` | Greater than or equal |
| `$lt` | Less than |
| `$lte` | Less than or equal |
| `$in` | Matches values in array |
| `$nin` | Excludes values in array |

### Logical Operators

- `$and` - All conditions must match
- `$or` - Any condition must match

### Example

```json
{
  "$and": [
    { "genre": { "$eq": "drama" } },
    { "year": { "$gte": 2020 } }
  ]
}
```

**Note**: Keys with leading underscores are reserved. Custom metadata with underscores returns 422 error.

## Partitions

- Lowercase alphanumeric (may include underscores/hyphens)
- Auto-created when documents added
- Default: `"default"`
- Use for multi-tenant data isolation

## Rate Limits

| Endpoint | Developer | Starter | Pro |
|----------|-----------|---------|-----|
| Document creation | 30-100/m | 50-200/m | 100-400/m |
| Document retrieval | 1000/m | 2000/m | 4000/m |
| Retrievals | 10/m | 500/m | 1000/m |
| Responses | 5/d | 20/d | 40/d |

## Error Codes

| Code | Error | Resolution |
|------|-------|------------|
| 400 | Bad Request | Verify request format |
| 401 | Auth Failure | Check API key |
| 402 | Limits Exceeded | Upgrade plan |
| 404 | Not Found | Verify endpoint/resource |
| 422 | Validation Error | Fix request data |
| 429 | Rate Limited | Stagger requests |
| 500 | Server Error | Contact support |

## Best Practices

1. **Use metadata filters** - Pre-filter for relevant chunks
2. **Enable reranking** - Improves result quality
3. **Configure top_k** - Balance completeness vs performance
4. **Use partitions** - Scope searches to relevant documents
5. **Handle pagination** - Max 100 items per page, use cursor
6. **Implement retry logic** - Exponential backoff for 429 errors
7. **Wait for ready state** - Before querying new documents

## Resources

- Docs: https://docs.ragie.ai/reference
- Support: support@ragie.ai
- Discord: https://discord.gg/wJnCeAmMpT
