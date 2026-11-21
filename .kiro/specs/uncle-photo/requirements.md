# Requirements: Uncle Photo Sharing

## Introduction
Anonymous, public photo sharing where an AI judge gates each upload by "uncle-ness".

## Requirements

### 1. Browse the feed
**User story:** As a visitor, I want to see everyone's photos so I can enjoy the uncle gallery.
1. WHEN the page loads THEN the system SHALL show the newest 12 photos.
2. WHEN more photos exist THEN the system SHALL show a "Load more" control that fetches the next page.
3. IF the feed fails to load THEN the system SHALL show an error and a retry button, and SHALL NOT crash.
4. WHEN there are no photos THEN the system SHALL show an empty state.

### 2. Analyze a photo
**User story:** As a sharer, I want to know if my photo is uncle enough before posting.
1. WHEN a user picks a photo THEN the system SHALL shrink it in the browser to at most 1024px and under ~900 KB.
2. WHEN the photo is sent for analysis THEN the system SHALL return a 0-100 score, a one-line verdict, trait checklist and retake tips.
3. IF the photo is unsafe (nudity, gore, hate, minors as main subject) THEN the system SHALL refuse to share it.
4. IF the AI is unavailable THEN the system SHALL show a friendly message and SHALL NOT allow posting.

### 3. Retake or Uncle-ify
**User story:** As a sharer with a low score, I want help passing.
1. IF score < 60 THEN the system SHALL show tips, a Retake button and an "Uncle-ify" button.
2. WHEN the user runs Uncle-ify THEN the system SHALL apply the filter in the browser and re-analyze the result.
3. The system SHALL show the score before and after the filter.

### 4. Share
**User story:** As a sharer, I want to publish a passing photo with an optional caption.
1. IF score >= 60 and the photo is safe THEN the system SHALL enable Share and a caption field (max 140 chars).
2. The system SHALL accept a post only with a valid, unexpired, server-signed token bound to the exact image bytes.
3. WHEN sharing succeeds THEN the new photo SHALL appear at the top of the feed immediately.

### 5. Like
1. WHEN a visitor likes a photo THEN the count SHALL increase atomically.
2. The browser SHALL remember likes locally so the same visitor can't like twice from the UI.

### 6. Reliability (non-functional)
1. Each API route SHALL rate limit per IP and return JSON errors, never stack traces.
2. Uploads SHALL be validated server-side (JPEG magic bytes, max 1.5 MB).
3. IF a database insert fails after upload THEN the system SHALL delete the orphaned file.
