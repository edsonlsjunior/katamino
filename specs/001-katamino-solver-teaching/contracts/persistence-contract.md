# Contract: Local Persistence (Progress & Preferences)

Boundary between the app and the browser's `localStorage`, covering FR-007 and the
language-switching persistence implied by FR-018. No server/backend is involved
(FR-015).

## Keys

| Key | Shape | Written when | Read when |
|---|---|---|---|
| `katamino:v1:progress` | `ProgressStore` (data-model.md) | A `ManualAttempt.isSolved` transitions `false → true` | App start (challenge list rendering), challenge detail open |
| `katamino:v1:lang` | `"pt" \| "en"` | User switches language (FR-018) | App start, before first render of any user-facing text |

## Read contract

- A read of a missing key, a key containing invalid JSON, or JSON that fails the shape's
  validation MUST be treated as "absent" and MUST fall back to a safe default
  (`{ version: 1, completed: {} }` for progress; a detected/browser-default locale for
  language) — never thrown as an unhandled error. This directly satisfies the spec edge
  case: "What happens if the browser's local storage is unavailable or cleared —
  completion progress degrades gracefully rather than breaking the app."
- Reads MUST also handle `localStorage` being entirely unavailable (e.g., disabled by
  browser settings/private mode restrictions in some browsers) by catching the access
  error and falling back the same way.

## Write contract

- Writes MUST be best-effort: a failing write (quota exceeded, storage disabled) MUST be
  caught and MUST NOT interrupt the user's current action (e.g., a solved challenge still
  shows its success state in-session even if persisting the completion flag fails).
- Writes MUST NOT block the UI thread perceptibly (`localStorage` is synchronous but the
  payloads here are small — a few KB at most for 500 challenges' worth of completion
  flags — so no async wrapper is required).
- Only `version: 1` is currently defined. A future breaking change to `ProgressStore`'s
  shape MUST bump `version` and include a migration (or explicit reset) path rather than
  silently misreading old data, per the constitution's requirement that breaking changes
  to data formats be versioned or migrated.

## Non-goals

- No cross-device sync, no accounts, no export/import — explicitly out of scope per the
  spec's Assumptions ("No user accounts or server-side backend exist").
