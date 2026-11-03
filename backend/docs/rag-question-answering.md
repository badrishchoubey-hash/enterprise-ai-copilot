# RAG question answering

The RAG path uses the Task 4 Gemini embedding configuration for question vectors,
MongoDB Atlas Vector Search for permission-scoped retrieval, and a configurable
Gemini chat model for grounded answers. `questionAnsweringValidation.ts`,
`vectorRetrievalService.ts`, `ragPromptService.ts`, and `chatModel.ts` contain
the validation/retrieval/prompt boundaries and Gemini provider configuration.
The authenticated endpoint is `POST /api/v1/ai/ask`.

## Access control

This deployment serves one company and has no organization or tenant boundary.
Employee and support-agent retrieval is limited to organization-visible
documents and same-department documents. Private documents are excluded from
non-admin retrieval. Admin retrieval can include private documents. The Atlas
query filters chunk visibility and department metadata, then rechecks the live
Documents record before sending evidence to the LLM. Conversation history is
scoped by owning user.

## Vector index

Create a Vector Search index on the `DocumentChunks` collection named by
`VECTOR_SEARCH_INDEX_NAME` (default `document_vector_index`). For the current
default model, use 768 dimensions; if `EMBEDDING_DIMENSIONS` is set, use that
same value in Atlas. Index all prefilter fields as `filter` fields:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "visibility" },
    { "type": "filter", "path": "department" },
    { "type": "filter", "path": "embeddingModel" }
  ]
}
```

For `gemini-embedding-2`, Task 4 prefixes documents as `title: none | text: ...`
and questions as `task: question answering | query: ...`, following Google's
recommended format for asymmetric RAG embeddings. This model does not accept the older
`taskType` field. The embedding model identifier stored on chunks includes the
prefix version and dimensions. Existing unprefixed Gemini 2 vectors remain
searchable using a matching unprefixed query embedding; they are not generated
again. Vectors from a different model are rejected before retrieval. The vector stage prefilters by
visibility, department, and embedding model. It then joins the authoritative
`Documents` record and checks
the current access metadata and completed status again before evidence reaches
the prompt. Atlas index creation is required; query errors return an explicit
service error and are never converted into "no results." See MongoDB's
[$vectorSearch query documentation](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/)
and [vector index field definitions](https://www.mongodb.com/docs/vector-search/indexes/).

## Environment

Set `GOOGLE_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_CHAT_TEMPERATURE`,
`GEMINI_CHAT_MAX_OUTPUT_TOKENS`, `AI_MAX_QUESTION_LENGTH`, and the
`VECTOR_SEARCH_*` values from `.env.example`. Use the exact same embedding model
and dimensions for ingestion and question queries. Existing vectors generated
by a different model are detected and retrieval returns
`409 EMBEDDING_MODEL_MISMATCH` rather than comparing incompatible vectors.
The service never re-embeds completed documents automatically.

## API

Send a bearer access token with:

```http
POST /api/v1/ai/ask
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "question": "What is the company's work-from-home policy?",
  "conversationId": "optional-existing-conversation-object-id"
}
```

Example response:

```json
{
  "success": true,
  "message": "Answer generated successfully.",
  "data": {
    "answer": "Employees may work remotely with manager approval [S1].",
    "sources": [
      {
        "sourceId": "S1",
        "documentId": "65f000000000000000000001",
        "documentName": "HR_Work_From_Home_Policy.pdf",
        "page": 4,
        "section": "Remote Work Policy",
        "chunkIndex": 3,
        "chunkId": "65f000000000000000000002",
        "score": 0.82
      }
    ],
    "conversationId": "65f000000000000000000003"
  }
}
```

Omit `conversationId` to start a conversation. The response returns an answer,
verified citations, and the conversation ID for follow-up questions. If no
chunks meet the configured score threshold, the exact response is
`I could not find this information in the available knowledge base.` and the
chat model is not called.

In Postman, obtain an access token from the existing login endpoint, set it as a
Bearer token, and POST the example JSON to `{{backendUrl}}/api/v1/ai/ask`. Use
the returned `conversationId` for a follow-up. Configure the Atlas index first;
an absent or failing vector index returns `503 VECTOR_SEARCH_UNAVAILABLE`.
