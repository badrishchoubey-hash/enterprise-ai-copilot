# Document ingestion

The admin upload flow stores an authenticated raw asset in Cloudinary, then calls
`POST /api/v1/admin/documents` to finalize it. The backend downloads that asset
to a size-limited temporary file, computes SHA-256 from its bytes, validates the
file signature, parses it, and rejects corrupt or text-empty documents before
creating the document record. Supported extensions are PDF, DOCX, legacy DOC,
TXT, Markdown, and CSV.

After finalization, the API responds with the document in `processing` state.
The worker cleans and splits the LangChain loader output, requests embeddings in
batches, and stores each chunk, its vector, model, source metadata, tenant,
department, and visibility in `DocumentChunks`. A completed document exposes
`totalChunks` and `processedAt`; a failed document exposes a safe `errorMessage`
and can be retried with `POST /api/v1/admin/documents/:documentId/retry`.

The default embedding provider is LangChain `GoogleGenerativeAIEmbeddings` with
Gemini Embedding 2. Configure `GOOGLE_API_KEY`. Optionally configure
`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` (defaults to 768 for Gemini Embedding
2), and `EMBEDDING_BATCH_SIZE`. To use OpenAI instead, set
`EMBEDDING_PROVIDER=openai`, configure `OPENAI_API_KEY`, and optionally set
`EMBEDDING_BASE_URL` for an OpenAI-compatible endpoint. Chunk size and overlap are configurable with
`DOCUMENT_CHUNK_SIZE` (default 1000 characters) and `DOCUMENT_CHUNK_OVERLAP`
(default 200 characters). The process validates vector dimensions and finite
numeric values. Failed runs remove partial chunks so retry starts cleanly.

## MongoDB indexes

Mongoose declares the unique `{ tenantId: 1, fileHash: 1 }` index on `Documents`
for duplicate detection, and unique `{ documentId: 1, chunkIndex: 1 }` plus
`{ tenantId: 1, documentId: 1, chunkIndex: 1 }` on `DocumentChunks`. Ensure
these indexes are built before enabling uploads. Production deployments should
manage index creation deliberately (`autoIndex` is generally disabled in
production) and verify them with `db.documents.getIndexes()` and
`db.documentchunks.getIndexes()`.

For future semantic retrieval, create an Atlas Vector Search index on
`DocumentChunks.embedding`. The vector dimension must match the configured
embedding model/dimensions. A representative Atlas index definition is:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "tenantId" },
    { "type": "filter", "path": "visibility" },
    { "type": "filter", "path": "department" },
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

The API computes the content hash itself; clients must not send a hash. A
duplicate upload in the same tenant returns HTTP 409.
