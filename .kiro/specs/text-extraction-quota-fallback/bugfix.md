# Bugfix Requirements Document

## Introduction

When a user uploads a PDF or image document for text extraction (for example, an exam schedule upload), the backend routes the file through `extractTextFromBuffer` in `backend/utils/extractText.js`, which uses the Gemini API across up to 5 rotating API keys and several model names. When every key/model combination returns a rate-limit / quota error (HTTP 429 / `RESOURCE_EXHAUSTED`, including the free-tier `limit: 0` case), the function throws and the upload handler in `backend/routes/examScheduleRoutes.js` returns a `400` error with a message like:

> Text extraction failed: AI text extraction failed (tried 5 key(s)): Key #1: [GoogleGenerativeAI Error]: ... [429] You exceeded your current quota...

Two gaps cause this user-facing failure:

1. **No retry/backoff for transient 429s.** The Gemini error itself suggests "retry in 12.7s", but the code immediately moves to the next key/model and never retries a key after a backoff interval.
2. **No fallback to the existing AWS Textract extractor.** `backend/config/textract.js` already implements `extractTextFromFile` (using Textract `DetectDocumentText`, which works on raw buffers via `Document.Bytes` and supports PNG/JPEG/single-page PDF), but this path is never invoked when Gemini extraction fails. As a result, a quota exhaustion that is entirely recoverable via Textract instead surfaces as a hard upload failure.

This fix makes text extraction resilient to Gemini quota exhaustion so users can still extract text from documents when the Gemini free tier is exhausted, while preserving current behavior whenever Gemini succeeds.

## Bug Analysis

### Current Behavior (Defect)

When all Gemini keys/models are rate-limited or out of quota, the extraction fails outright and the upload is rejected, even though a working fallback extractor exists.

1.1 WHEN a PDF or image is uploaded and every Gemini key/model combination returns a rate-limit/quota error (429 / `RESOURCE_EXHAUSTED` / `quota`, including free-tier `limit: 0`) THEN the system throws from `extractTextFromBuffer` and the upload handler returns a 400 "Text extraction failed" error to the user.

1.2 WHEN a Gemini key returns a transient rate-limit error that indicates a retry-after delay (e.g. "Please retry in 12.7s") THEN the system does not wait and retry that key/model, it only advances to the next key/model and ultimately throws once all are exhausted.

1.3 WHEN Gemini extraction is exhausted by quota errors THEN the system does not attempt the already-implemented AWS Textract extractor (`extractTextFromFile` in `backend/config/textract.js`), so a recoverable extraction is reported as a permanent failure.

### Expected Behavior (Correct)

For the same quota-exhaustion conditions, the system should recover via retry and/or Textract fallback and return extracted text instead of failing.

2.1 WHEN a PDF or image is uploaded and every Gemini key/model combination returns a rate-limit/quota error THEN the system SHALL fall back to AWS Textract extraction and, when Textract succeeds, return the extracted text so the upload proceeds normally.

2.2 WHEN a Gemini key returns a transient rate-limit error that indicates a retry-after delay THEN the system SHALL apply a bounded retry with backoff before treating Gemini extraction as failed and moving on to the fallback.

2.3 WHEN both Gemini extraction (after retries) and the AWS Textract fallback fail to produce text THEN the system SHALL return a clear, actionable error indicating extraction was not possible, rather than silently succeeding with empty text.

### Unchanged Behavior (Regression Prevention)

Successful and non-quota paths must behave exactly as they do today.

3.1 WHEN a Gemini key/model successfully extracts text THEN the system SHALL CONTINUE TO return that extracted text and advance the round-robin key index as it does today (no Textract call is made).

3.2 WHEN a CSV file is uploaded THEN the system SHALL CONTINUE TO parse it via the existing CSV path without invoking any AI/Textract extraction.

3.3 WHEN a Gemini call fails with a non-rate-limit error (e.g. model `404`/not found, auth `401`/`403`) THEN the system SHALL CONTINUE TO handle it as it does today (skip/advance) without introducing inappropriate retries for those cases.

3.4 WHEN extraction (via any path) yields no readable text THEN the system SHALL CONTINUE TO return the existing "could not find any readable text" 400 response.

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = { fileBuffer, mimetype }  // a non-CSV PDF/image extraction request
  OUTPUT: boolean

  // Every Gemini key/model combination fails with a rate-limit / quota error
  // (429 / RESOURCE_EXHAUSTED / quota, including free-tier limit:0),
  // while a working extraction is still possible (e.g. via Textract or a retry).
  RETURN isExtractionRequest(X)
         AND allGeminiAttemptsRateLimited(X)
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking — Quota exhaustion falls back instead of failing
FOR ALL X WHERE isBugCondition(X) DO
  result ← extractTextFromBuffer'(X.fileBuffer, X.mimetype)
  // When Textract (or a successful retry) can extract text, the request succeeds.
  ASSERT (textractCanExtract(X) IMPLIES result = extractedText AND no_throw(result))
  // When even the fallback cannot extract, the error is clear and actionable.
  ASSERT (NOT textractCanExtract(X) IMPLIES throws_actionable_error(result))
END FOR
```

### Preservation Goal (Preservation Checking)

```pascal
// Property: Preservation Checking — non-buggy inputs unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT extractTextFromBuffer(X) = extractTextFromBuffer'(X)
END FOR
```

Where `extractTextFromBuffer` is the original (unfixed) function and `extractTextFromBuffer'` is the fixed function. Non-buggy inputs include: Gemini succeeding on some key/model, CSV uploads, non-rate-limit Gemini errors, and empty-text results.
