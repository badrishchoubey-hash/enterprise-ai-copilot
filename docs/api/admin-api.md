# Admin API

Admin endpoints are under `/api/v1/admin` and require an `Authorization: Bearer <accessToken>` header for an active user whose role is `admin`. JSON endpoints use `Content-Type: application/json`.

## Documents and knowledge base

| Method   | Path                          | Purpose                                                                                                                      |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/documents/upload`           | Upload one `file` multipart field. Optional fields: `department`, `visibility` (`private`, `department`, or `organization`). |
| `GET`    | `/documents`                  | List documents. Supports `page`, `limit` (max 100), `search`, `status`, `department`, and `visibility`.                      |
| `GET`    | `/documents/:documentId`      | Read document metadata.                                                                                                      |
| `GET`    | `/documents/:documentId/file` | Download the stored original file.                                                                                           |
| `PATCH`  | `/documents/:documentId`      | Update `name`, `department`, and/or `visibility`.                                                                            |
| `DELETE` | `/documents/:documentId`      | Delete the document, stored file, chunks, and its message citation references.                                               |
| `GET`    | `/knowledge-base`             | Return document, chunk, storage-size, status, and department totals.                                                         |

Uploads accept the file types and size limit configured by the existing upload validation middleware. Files are stored in MongoDB GridFS. The current project has no extraction, embedding, or background ingestion worker, so a successful upload is reported as `uploaded`; it is not reported as processed.

The web console currently caps uploads and downloads at 4 MB because its Vercel Function proxy has a 4.5 MB request and response payload limit. Direct requests to the backend may use the backend's larger configured upload limit.

## Users

| Method   | Path             | Purpose                                                                                                                |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/users`         | List and search users. Supports `page`, `limit`, `search`, `role`, and `isActive`. Password hashes are never returned. |
| `POST`   | `/users`         | Create an account with `name`, `email`, `password`, and optional `role` and `department`.                              |
| `PATCH`  | `/users/:userId` | Update `name`, `email`, `role`, `department`, or `isActive`.                                                           |
| `DELETE` | `/users/:userId` | Deactivate a user; this is a soft delete.                                                                              |

Public registration cannot assign the `admin` role. An existing admin must create or promote an administrator through the admin API. The last active admin cannot be deactivated or demoted.

## Analytics

`GET /analytics?days=30` returns user counts by role, document counts by status, storage usage, query count and average latency/result count, and feedback totals for the requested period. `days` accepts 1 through 365.

Successful responses use `{ "success": true, "data": ... }`. Errors use the backend's standard `{ "error": "...", "code": "...", "requestId": "..." }` shape.
