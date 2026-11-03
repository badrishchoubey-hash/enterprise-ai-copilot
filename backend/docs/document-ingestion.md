# Document ingestion

The admin upload flow stores an authenticated raw asset in Cloudinary, then calls
`POST /api/v1/admin/documents` to finalize it. The backend downloads that asset
to a size-limited temporary file, computes SHA-256 from its bytes, validates the
file signature, parses it, and rejects corrupt or text-empty documents before
creating the document record. Supported extensions are PDF, DOCX, legacy DOC,
TXT, Markdown, and CSV.

After finalization, the API responds with the document in `processing` state.
The worker cleans and splits the LangChain loader output, requests embeddings in
batches, and stores each chunk, its vector, model, source metadata, department,
and visibility in `DocumentChunks`. A completed document exposes
`totalChunks` and `processedAt`; a failed document exposes a safe `errorMessage`
and can be retried with `POST /api/v1/admin/documents/:documentId/retry`.
Administrators can reprocess a legacy completed document that has no indexed
chunks with `POST /api/v1/admin/documents/:documentId/reprocess`. This only
accepts completed records whose `totalChunks` is zero or missing; the source
file remains stored, and the document is hidden from retrieval while it is
being indexed.

The default embedding provider is LangChain `GoogleGenerativeAIEmbeddings` with
Gemini Embedding 2. Configure `GOOGLE_API_KEY`. Optionally configure
`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` (defaults to 768 for Gemini Embedding
2), and `EMBEDDING_BATCH_SIZE`. To use OpenAI instead, set
`EMBEDDING_PROVIDER=openai`, configure `OPENAI_API_KEY`, and optionally set
`EMBEDDING_BASE_URL` for an OpenAI-compatible endpoint. Chunk size and overlap are configurable with
`DOCUMENT_CHUNK_SIZE` (default 1000 characters) and `DOCUMENT_CHUNK_OVERLAP`
(default 200 characters). The process validates vector dimensions and finite
numeric values. Failed runs remove partial chunks so retry starts cleanly.

During processing, `processingProgress` exposes `completedChunks`, `totalChunks`,
and an optional `retryAt` when Gemini asks the worker to wait. The Gemini client
allows at most three quota retries across the entire document, rather than
resetting the allowance for every batch. Only explicit retry delays below one
minute are retried automatically. Daily limits are not retried. The documents
page checks active work every 15 seconds, defers checks until a known retry time,
and pauses checks while the tab is hidden. The local server checks for expired
worker heartbeats every minute; workers interrupted by a restart become failed
after their heartbeat has been stale for five minutes and can then be retried.

## MongoDB indexes

Mongoose declares a unique `{ fileHash: 1 }` index on `Documents` for duplicate
detection and a unique `{ documentId: 1, chunkIndex: 1 }` index on
`DocumentChunks`. Production deployments should
manage index creation deliberately (`autoIndex` is generally disabled in
production) and verify them with `db.Documents.getIndexes()` and
`db.DocumentChunks.getIndexes()`.

Semantic retrieval requires an Atlas Vector Search index on
`DocumentChunks.embedding`. The vector dimension must match the configured
embedding model/dimensions. Run `npm run setup:vector-index` to create the
configured index if absent. Run it again to check that `queryable` is true.
This command adds an index; it does not replace an existing index. The answer
endpoint reports `VECTOR_INDEX_NOT_READY` while the index is absent or building,
rather than treating the missing index as an empty knowledge base.
A representative Atlas index definition is:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "visibility" },
    { "type": "filter", "path": "department" },
    { "type": "filter", "path": "embeddingModel" },
    { "type": "filter", "path": "documentId" }
  ]
}
```

Replace `numDimensions` to match `EMBEDDING_DIMENSIONS` and the selected model. The vector index is not
required for ingestion itself; it is required before vector search is enabled.

## Local setup and verification

Copy `.env.example` to `.env`, fill in MongoDB, Cloudinary, JWT, and OpenAI
credentials, then run:

```sh
npm install
npm run build
npm test
```

Tests use deterministic mocked embedding vectors and do not call OpenAI. They
cover cleaning, TXT/CSV loading, vector chunk persistence, cleanup after an
embedding failure, and server-side hash/size enforcement. A real provider
smoke test requires a configured API key and is not run by the test suite.

## Postman smoke flow

1. Authenticate using the existing admin login and retain the bearer token.
2. Request the existing document upload signature endpoint with filename,
   MIME type, and size.
3. Upload the file bytes directly to the returned Cloudinary signed endpoint.
4. Finalize with `POST /api/v1/admin/documents`, sending the returned
   `publicId` and `version`, plus filename, MIME type, and file size.
5. Poll `GET /api/v1/admin/documents/:documentId` until status is `completed`
   or `failed`. A failed document can be retried with the retry endpoint above.
   A completed document with zero indexed chunks can be reprocessed from the
   Manage documents page or with the reprocess endpoint.

The API computes the content hash itself; clients must not send a hash. A
duplicate upload returns HTTP 409.

## Existing database notes

The former application version stored `tenantId` fields and tenant-prefixed
indexes. This version ignores those legacy fields and does not unset them or
modify database records at startup. Before deployment, inspect existing
`Documents` for duplicate `fileHash` values and review actual indexes. A global
unique `{ fileHash: 1 }` index cannot be built until duplicate values are
resolved. Back up first, then plan any required index replacement explicitly;
do not drop indexes or rewrite hashes as an automatic startup step. Old indexes
may remain alongside the new definitions until an operator deliberately
reconciles them. This includes document indexes prefixed by `tenantId`, the
conversation index prefixed by `tenantId`, and the chunk index prefixed by
`tenantId` (the separate unique `{ documentId: 1, chunkIndex: 1 }` index stays).
Update the Atlas Vector Search definition to remove its `tenantId` filter field
and retain `visibility`, `department`, and `embeddingModel` filters.
