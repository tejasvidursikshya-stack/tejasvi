# Tejasvi Campus 3.10.0

Learning and institutional operations run in **one Node application on one origin** backed by **one MySQL database**. This release combines the fresh-start LMS and EMIS. Open [START-HERE.txt](START-HERE.txt) for the Mac walkthrough.

**New in 3.10.0: the native Android learning pilot.** The `android/` folder contains Kotlin + Jetpack Compose source and `android/pilot/Tejasvi-Android-Pilot.apk`. Existing users sign in through the versioned mobile API to the same institution and MySQL records. Students read lessons and units, take quizzes, submit assignments and files, and see feedback and progress; assigned teachers review, grade and return work. Follow [the Android setup guide](docs/android-pilot.html). Update the original **3.9.0** installation with `Update-Tejasvi.command`, then run `Test-Android-USB.command` with your Mac server and one Android phone connected. No new database is needed. Native EMIS, AI, push, offline lessons and iOS are later milestones; the current server remains a local pilot.

**New in 3.9.0: the daily learning workflow.** Teachers and learners open a focused home with next steps, pending quizzes, assignments, feedback and live classes. **Assessment & progress → Gradebook** brings released assignment marks, current-version quiz attempts and additional college marks together. Staff review an explicit selection before approving a saved result revision. Learning progress includes learners who have not started; reading, quizzes and marks remain separate. School/college administrators can send an approved result to an exactly linked EMIS examination as a **Draft**, scaled to its maximum marks. Existing examination results are not overwritten. See [the learning workflow guide](docs/learning-workflow.html).

**Student enrollment in 3.8.1:** Learning → People & organization → Student directory now reads the school or college’s EMIS enrollments directly from MySQL. Existing and new enrollments appear before login activation; switch academic year to see older records. An administrator can activate a new login or explicitly link an existing one, then assign the actual Learning intake or batch and subjects. The student’s EMIS Learning summary and LMS now use the same published-course access rules. See [the student access guide](docs/student-access.html).

**New in 3.8.0: the EMIS dashboard.** A dark illustrated header, a light sidebar, three small charts, a follow-up panel, a sortable register and detailed charts bring the Material Shadcn layout to EMIS. Chart values come from records the signed-in user can already see. The selector at the top opens Overview, Reports & details (My records for students), or the school/college profile. [Dashboard guide](docs/emis-dashboard.md).

In Learning, **Teaching & content → Tutoring cards** lets teachers write, design, rehearse and save cue cards and flashcards in MySQL. Teachers can share a flashcard snapshot to a published course they teach. Students open **Practice flashcards** in that course. No AI service is required. See [the tutoring guide](docs/tutoring-cards.md).

| Organization | Products |
| --- | --- |
| School | Learning plus school EMIS, including school annual reporting |
| College | Learning plus college EMIS, including academic, finance, HR, quality and reporting workflows |
| Corporate or EdTech provider | Learning only |

## Learning navigation and Tejasvi AI

The LMS sidebar groups actions by task and remembers expanded groups for each workspace and role. **Tejasvi AI** is the single entry for writing and generating teaching materials, reviewing drafts, chat, voice conversations, narrated lesson films and the optional live presenter. Students and employees get conversation tools only; published course films are available under the usual course permissions. See the [activation guide](Tejasvi-AI-Activation-Guide.html). Provider credentials stay in server settings. The platform Super Admin controls each institution’s access in MySQL. No live AI credentials or demo accounts are in this download.

**Homepage teaching gallery (3.6.1).** In AI Creator Studio, choose a college, school or workplace sample and open any of six photographic format cards. The worked examples can be tried without signing in, and educators can continue to the corresponding tool in Learning. The self-contained homepage preview opens at the gallery when built with `npm run preview:homepage -- --gallery`. This update adds no database migration to 3.6.0.

**Gamma presentations (3.6.0).** In Learning → Tejasvi AI → Presentations, educators can design an editable PowerPoint from a lesson brief or an existing Studio slide draft. Choose a slide count, English or Hindi, and optional illustrations. Jobs and ownership live in MySQL. Completed PowerPoints are kept under the protected uploads folder; signed provider export links are never given to learners. Review, attach a copy to a published course, update it, or withdraw it through the existing course permissions.

**Connect Gamma on the Mac:** run Configure-AI.command → **4 — Gamma**, paste a Gamma API key locally and restart. In each institution’s **Connections**, check Gamma, enable staff AI and **Gamma presentations**, optionally choose a custom Gamma theme, then save. Gamma uses its own credentials and credits and does not need OpenAI or LiveAvatar. The existing OpenAI/native slide export remains available, including for Nepali teaching drafts. For key setup, a first Java example and troubleshooting, see the [AI activation guide](Tejasvi-AI-Activation-Guide.html#gamma).

**Presenter voices (3.5.2).** Connections and Start now verify the same voice using the server’s LiveAvatar key. An unavailable saved Sandbox voice can use Wayne’s verified default. Live mode keeps its selected voice and tells the operator if it is unavailable. In **Configure-AI.command → 2 — LiveAvatar**, select the avatar’s default or browse public and private voices by name. The helper verifies the choice without starting video. Sandbox choices leave the saved Live voice untouched.

## Workspace setup

On **My workspaces → Create organization**, choose a type, then enter the details in a focused form. School and college workspaces need a name and academic year; corporate and EdTech workspaces need a name. Expand **Contact & registration** to enter optional details. Use **Change type** to return to the choices without discarding your contact details. The same form also opens after first-owner setup.

The automatic updater in this download accepts **Campus 3.9.0**. Stop the app, back up MySQL and uploads with `npm run backup`, run **Update-Tejasvi.command** from the new download and select your configured 3.9.0 folder. Restart **Start-Tejasvi.command** in that original folder. Launch applies migration **025_mobile_sessions.sql** to the existing database. Accounts, institutions, uploads and AI settings stay in the original installation. Locally edited source files are detected before changes. Older versions require a separately verified upgrade; this updater leaves them unchanged. For an offline preview of the actual form, run `npm run preview:setup` and open `build/workspace-setup-preview.html`.

## Updated homepage

The homepage combines a full-width rotating banner, a sample dashboard next to a verifiable edition comparison, and an animated four-object Creator Studio. The signed-in LMS offers the same teaching outputs in a focused creation form. Real authoring uses MySQL and the signed-in institution’s permissions. See [HOMEPAGE-3.4.txt](HOMEPAGE-3.4.txt) to update your Mac and [Creator Studio](docs/creator-studio.md) to create, export or publish teaching materials. Walkthrough requests are still saved for the platform Super Admin. Run `npm run preview:homepage` for the offline demonstration.

## Run locally

Use Node 24+ and MySQL 8+. Double-click **Start-Tejasvi.command** or run `npm ci --include=dev`, then `npm start` in this directory. Open the private link printed on first launch to create one Super Admin. Use `http://localhost:3000/workspaces` after sign-in. A new database has no owners, institutions or business records. Setup uses an unused database name and a dedicated MySQL user. No old application or data folder is needed.

## Shared records and permissions

Organizations, credentials and login sessions have one source in MySQL. Membership and role are scoped to an organization. The server verifies the session, organization type, membership and applicable role on every EMIS request, including downloads. EMIS tables and uploaded files are partitioned by organization. A corporate organization has no EMIS workspace. The platform owner creates organizations; delegated institution administrators only manage assigned members. Institutional staff do not acquire teaching privileges automatically.

The institution’s name and contacts are shared. A Learning student/teacher account gets a linked EMIS directory entry; names and supported student contact/admission fields update across the products. An EMIS record alone does not grant login. EMIS Users & access can create a shared login for it or attach an existing login explicitly. Membership suspension in EMIS removes access for that organization in both products without deleting academic history. Disabling a member at one institution leaves access to their other institutions intact.

Official subject allocations can be published from EMIS to Learning without re-entering the subject. Repeat publishing is idempotent. For colleges, the subject goes into the appropriate department/program/semester. Publishing does not create lesson content, enroll all students, or overwrite course assessments. Learning activities remain separate from official EMIS examination results. The new gradebook requires explicit staff approval and an administrator transfer to a mapped examination; the resulting Draft still needs EMIS review and publication.

## Maintenance

| Command | What it does |
| --- | --- |
| `npm run setup` | Provision one unused database and its scoped runtime account. |
| `npm start` | Reuse this folder’s private settings; build if needed and serve both products on one port. |
| `npm run build` | Build the EMIS client and Next.js Learning application. |
| `npm run doctor` | Verify this folder’s installation identity and database access. |
| `npm run user:password` | Locally reset an existing shared account and revoke its sessions. |
| `npm run backup` | Dump the shared database and copy both Learning and organization-specific EMIS files. Stop writes while backing up; mysqldump must be on PATH. |

This package is configured for local testing on the Mac. It does not publish a school or company site. The public home, account pages and learning workspaces use Next.js; the EMIS client lives in `modules/emis`. The Node server authorizes its views and APIs on the same origin. All schema migrations are in `database/migrations`. Keep the generated `.env`, storage and backups private.
