# Frontend coding guidelines

## Structure

- Keep route entry points in `app/` thin. Dynamically import feature pages when they are interactive or heavy.
- Organize feature-owned UI under `features/<feature>/components`, domain types under `types`, and Redux logic under `features/store`.
- Keep API clients, schemas, and UI components separate so the mock data layer can be replaced by `/api/v1` services without redesigning screens.

## React and TypeScript

- Prefer small, focused components with explicit props and domain types.
- Use `React.memo` for expensive repeated rows, `useMemo` for derived filtered data, and `useCallback` for callbacks passed into memoized children.
- Use strict TypeScript types; avoid `any`, inline API response shapes, and duplicated string literals.
- Keep route pages server components by default. Add `"use client"` only where state, event handlers, browser APIs, or form libraries require it.

## Forms and state

- Use React Hook Form with Zod schemas for all user input, including file validation.
- Keep cross-page/domain state in Redux Toolkit slices and local interaction state in components.
- Model async states explicitly: loading, empty, success, and failure. Failed document jobs must expose a retry action.

## Accessibility and UX

- Use semantic controls, visible focus states, keyboard-accessible buttons, labels, and meaningful empty/error states.
- Preserve responsive behavior from mobile through desktop. Avoid fixed-width tables without a scroll boundary.
- Never display secrets, stack traces, or raw internal API errors in the UI.
- Keep access and refresh tokens in `httpOnly`, `sameSite=lax` cookies. Use `secure=true` in production and never put tokens in localStorage, Redux, or client-readable state.

## API readiness

- Backend integrations must use versioned `/api/v1` endpoints from `PROJECT_REQUIREMENTS.md`.
- Document status values are `uploaded`, `processing`, `completed`/`processed`, and `failed`; map API status at the service boundary.
- Preserve metadata needed for citations: document id, page/section, chunk id, access scope, and retrieval score.
