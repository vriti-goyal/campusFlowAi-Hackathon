# Known Issues

The following known issues are documented for the CampusFlow AI platform:

- **Batch ID propagation in dashboard**: `GET /api/batch/my-batches` populates `batchId`, but the spread in `batchRoutes` may lose `_id` if `batchId` is not populated. 
  - *Workaround*: The frontend uses `batchRes.data[0]._id` instead of `batchRes.data[0].batchId._id` as a safe fallback.
- **Upload.jsx finalize state sync**: After calling `POST /api/upload/finalize`, the edited extraction is confirmed server-side but the frontend does not update the stored extraction state. Any subsequent edits to the displayed review card are lost.
- **AI context not user-scoped for assignments/exams**: `gatherUserContext` still fetches assignments and exams without filtering by `userId`, so the AI sees all batch assignments, not just those owned by the requesting user.
- **No pagination on posts feed**: `GET /api/posts/:batchId` returns all posts without pagination. Large batches may cause slow loads and degraded frontend performance.
- **Missing logout token invalidation**: On logout, the Firebase token is cleared from the client but there is no server-side session revocation. Any intercepted token remains valid until its 1-hour expiry.
