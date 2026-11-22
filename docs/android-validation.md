# Android pilot validation — Tejasvi Campus 3.10.0

The source and testing APK were built on Linux. No real institution database, provider credentials or paid AI calls were used for validation. The APK has not been run on Krishna's Mac or physical phone. Device acceptance testing remains the next step in `android-pilot.html`.

## Application and database checks

- Production build of the existing Next.js application and EMIS client completed.
- Isolated real MySQL fixture: school, college and corporate memberships, college subject/intake assignments, courses, units, quizzes, submissions and grades.
- Existing web tests passed in Chromium: teacher and learner homes, gradebook, result approval, learner progress, mobile browser layout, no page errors, correct scoped rosters, stale-result rejection and idempotent transfer to an EMIS examination draft.
- The mobile API passed real HTTP checks for existing-user login, incorrect credentials, token rotation, replay of a rotated refresh token, browser-cookie rejection at mobile endpoints, malformed bearer rejection and institution isolation.
- Course and unit quiz answers were absent from learner responses. Current quiz attempts worked; stale course quiz revisions returned a conflict.
- The native workflow's endpoints completed lesson and unit reading, accepted a protected PDF upload, created an assignment submission, returned it for revision, rejected a stale revision, accepted resubmission and released a grade and feedback. Progress read the resulting MySQL records correctly.
- A teacher from another intake could not read the submitted file or grade the learner. A learner could not grade their own work. School and corporate learners could not read the college workspace.
- An existing web password reset revoked the mobile access and refresh tokens. Temporary-password login required a password change; the mobile change issued a new session and revoked the previous one. Sign-out revoked that device session.
- Original browser origin and CSRF checks continued to reject a direct web write with only a mobile bearer token.

## Native Android checks

- Debug APK compiled for application ID `com.tejasvi.campus.pilot`, version code `31000`, Android API 26 minimum and API 36 target.
- Five JVM test methods passed: allowed server addresses, production HTTPS enforcement, loopback-only debug HTTP, one token rotation for simultaneous expired requests, preserving a draft after a version conflict, refusing authenticated redirects, and clearing credentials after revoked refresh. The methods include multiple assertions and rejection cases.
- Android lint completed with zero errors. One informational dependency-update warning remains for the deliberately pinned OkHttp 4.12.0; it is not a claim that all dependencies are the newest available.
- APK signature verification passed. This is a debug signature for the pilot, not production signing.
- The guide was checked at desktop and phone widths in Chromium without horizontal overflow. This is a guide-layout check, not a native-device screenshot test.

## Update and packaging checks

- The targeted updater was checked against the exact prior 3.9.0 ZIP. Source changes are verified before writes; settings and uploaded files are preserved; the prior build marker is backed up and invalidated; the Gradle wrapper and Mac launchers remain executable.
- A repeated update makes no changes. Conflicting local source edits and unsupported versions are rejected before mutation.
- The downloadable project includes Android source, the testing APK, backend migration and launch guides. It excludes MySQL settings, uploaded institution files, test databases, dependency caches, Android SDK/JDK downloads, production signing keys and API credentials.

## Practical limits of this pilot

- No physical Android device or Android emulator acceptance test was performed here. Verify login, readable text at your preferred font size, rotation, document opening, USB reconnection and the full learner/teacher loop on a real phone before inviting institutions.
- The current Tejasvi server launcher is intentionally local. Remote use requires a separate hosted HTTPS deployment. The APK alone does not host the server.
- Course text and server responses are not cached for offline reading. Text drafts are encrypted locally, but files must be reselected if the process closes before submission. A response conflict or network interruption requires an explicit refresh/retry.
- The API client caps JSON responses at 4 MiB and downloaded files at 30 MiB. Large institution-wide lists need pagination and performance testing before expanding this pilot.
- Native EMIS administration, course authoring, AI/voice/avatar, flashcards, push notifications, offline course sync, parent access and iOS are not implemented in this milestone. Existing web features remain available.
