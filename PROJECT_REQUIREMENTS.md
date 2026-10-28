# Enterprise AI Knowledge & Support Copilot

## Purpose

Build an enterprise assistant that lets employees and support agents search organizational knowledge, ask questions about uploaded documents, and receive grounded AI answers with source citations.

Supported knowledge includes HR policies, IT manuals, product documentation, employee handbooks, security policies, FAQs, and troubleshooting documents.

## User capabilities

- Register, log in, refresh sessions, and securely authenticate.
- Ask questions and receive streamed answers with document, page, and section citations.
- View, continue, rename, delete, and search conversation history.
- Submit helpful/not-helpful feedback.
- Receive only documents and chunks permitted by department/access policy.

## Roles

### Admin

- Upload, inspect, retry, and delete knowledge documents.
- Manage users and roles.
- Manage the knowledge base.
- View processing, usage, latency, and feedback analytics.

### Employee/User

- Use the chat and search experience.
- View their conversations and source citations.
- Access only public or authorized department knowledge.

## Required technology

| Area | Requirement |
| --- | --- |
| Frontend | Next.js, React, TypeScript/JavaScript, responsive HTML/CSS, Bootstrap or Tailwind |
| Backend | Node.js, Express.js, TypeScript/JavaScript, REST APIs, JWT, bcrypt, validation, middleware, centralized errors |
| Database | MongoDB with Mongoose |
| Vector search | Select one of Chroma, Pinecone, Qdrant, MongoDB Atlas Vector Search, FAISS, or PGVector |
| AI | LangChain.js, Gemini/OpenAI/Azure OpenAI or equivalent, embeddings, RAG, loaders, splitters, retrieval, re-ranking |
| Platform | Git, GitHub, Docker, Docker Compose, GitHub Actions/Jenkins/equivalent |
| Supporting services | Redis for caching and rate limiting; a background queue/worker for document processing |

## Core modules

1. Authentication and authorization: registration, login, refresh tokens, JWT middleware, RBAC, and role authorization.
2. MongoDB data layer: Users, Documents, DocumentChunks, Conversations, Messages, QueryLogs, Feedback, and AuditLogs with references, indexes, validation, timestamps, pagination, and access metadata.
3. Document management: PDF, DOCX, and TXT uploads; metadata; status tracking; retries; duplicate detection with SHA-256 hashes.
4. Ingestion pipeline: validate, extract, clean, split, embed, store vectors, store metadata, and mark the document ready. Prefer asynchronous processing.
5. RAG question answering: authorized vector retrieval, similarity threshold, metadata filters, query rewriting and/or re-ranking, grounded prompts, source citations, and an explicit no-answer response.
6. Conversational AI: bounded conversation context rather than sending unlimited history to the LLM on every request.
7. REST API: versioned `/api/v1` routes for auth, documents, chat, search, conversations, and admin operations.
8. OpenAPI/Swagger: document requests, responses, authentication, parameters, and errors.
9. Frontend: login, registration, dashboard, chat, documents, profile, and admin pages with protected routes, loading/error/empty states, validation, search, filtering, pagination, and responsive design.
10. Streaming: SSE or fetch/Node.js streaming from Express to Next.js for progressive answers.
11. Analytics and evaluation: response time, retrieval score, retrieved sources/chunks, generated answer, feedback, processing failures, and RAG quality metrics.
12. Resilience and security: timeouts, retries, circuit breakers, rate limits, idempotency, dead-letter handling, graceful degradation, safe logging, and secret management through environment variables.

## API surface

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

POST   /api/v1/documents/upload
GET    /api/v1/documents
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id

POST   /api/v1/chat
POST   /api/v1/search

GET    /api/v1/conversations
GET    /api/v1/conversations/:id
DELETE /api/v1/conversations/:id

GET    /api/v1/admin/users
GET    /api/v1/admin/analytics
DELETE /api/v1/admin/documents/:id
```

## Required operational behavior

- Redis must support at least AI response/query caching and per-user rate limiting (target example: 30 AI requests/minute/user), with documented TTL and invalidation rules.
- Document processing must expose `uploaded`, `processing`, `completed`, and `failed` states.
- Retrieval must enforce document-level authorization before chunks reach the prompt.
- Duplicate uploads and duplicate jobs must be idempotent.
- Failures from the LLM, vector store, MongoDB, Redis, workers, malformed LLM output, irrelevant retrieval, unauthorized access, and traffic spikes must be handled and observable.
- Secrets, passwords, API keys, database credentials, and internal stack traces must never be exposed.

## Testing and delivery

- Backend unit and integration tests with Jest and Supertest.
- Frontend tests for authentication, protected routes, chat, document lists, and UI states.
- End-to-end flow: register → login → upload → process → ask → retrieve → answer with sources → feedback.
- Dockerfiles, `docker-compose.yml`, `.env.example`, CI/CD workflow, health checks, API documentation, architecture diagram, database design, sample knowledge documents, failure-handling notes, scalability/performance notes, README, and a live technical demonstration.

## Target repository structure

```text
enterprise-ai-copilot/
├── frontend/
│   ├── app/                         # Next.js routes and layouts
│   │   ├── login/                   # /login
│   │   ├── register/                # /register
│   │   ├── dashboard/               # /dashboard
│   │   ├── chat/                    # /chat and /chat/[conversationId]
│   │   ├── documents/               # /documents and /documents/[id]
│   │   ├── profile/                 # /profile
│   │   └── admin/                   # users, documents, analytics
│   ├── components/
│   ├── hooks/
│   ├── services/                    # API clients and streaming clients
│   ├── utils/
│   ├── public/
│   └── middleware.ts                # protected-route checks
├── backend/
│   ├── src/
│   │   ├── config/                  # database, Redis, environment
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/                  # Mongoose collections
│   │   ├── middleware/              # auth, RBAC, validation, errors, logging
│   │   ├── auth/
│   │   ├── documents/               # upload and ingestion orchestration
│   │   ├── chat/
│   │   ├── rag/                     # retrieval, filtering, reranking, prompts
│   │   ├── llm/
│   │   ├── search/
│   │   ├── analytics/
│   │   └── utils/
│   ├── tests/{unit,integration,e2e}/
│   ├── package.json
│   └── server.ts
├── vector-store/                    # vector-store adapter/configuration
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── operations/
│   └── knowledge-samples/
├── .github/workflows/               # CI/CD
├── .env.example
├── docker-compose.yml
└── README.md
```

## Current implementation baseline and gaps

The repository currently contains a minimal Express/TypeScript backend. The database connection is being aligned with the required MongoDB/Mongoose stack; `backend/src/models/Users.ts` and the remaining Mongoose collections still need implementation. The frontend, RAG pipeline, Redis, workers, API routes, tests, Docker, CI/CD, and documentation deliverables also remain to be implemented.

This document is the requirements baseline; the new directories establish the target boundaries without fabricating unfinished application code.

