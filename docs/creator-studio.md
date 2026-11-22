# Creator Studio and the workspace dashboard

**For a pilot without an AI key:** sign in as staff, choose Tejasvi AI → Create, enter a topic and audience, and start a writing draft. Add slides, worksheet prompts, scenes or flashcards under **Saved drafts → Edit this output**. The writing path and exports are local. The separate public sample workspace uses browser state only.

**For live AI:** open [the owner activation guide](../Tejasvi-AI-Activation-Guide.html). The local configuration helper stores provider keys in the configured installation with mode 0600. The Super Admin then saves organization switches in MySQL. Learners do not have authoring or publishing rights.

| Tool | Input and result |
| --- | --- |
| AI Content Creation | A topic and audience become slides, quiz questions, worksheet activities, revision cards and storyboard scenes for a silent lesson film or printable storybook. |
| AI Course Builder | Supply a syllabus or curriculum goals. Review modules, objectives, assessments and linked subject before importing or publishing. Alignment is for educators to verify. |
| Lecture Assistant | Type notes during or after class; save them as an organizational draft. Configured AI can turn the notes into a session recap, quiz and revision cards. This does not record a microphone. |
| Lecture Planner | Specify a duration and an audience. Edit objectives, activities, facilitation notes and module minutes before publication. |

**Publishing.** Import keeps new modules and assignments in draft. For a new course only, Publish reviewed course explicitly publishes the reviewed work with assigned access. It cannot republish an existing course wholesale. For an imported draft, publish the course through its editor and then choose Share learner materials. The resource endpoint checks the course, organization, active membership and normal learner access on every read. Only the student-facing slide, worksheet, story and flashcard fields are released; grade keys, source notes and staff facilitation stay private. Revision-card answers are intentionally visible after a flip. Withdrawing stops future access inside the app; previously downloaded files remain with the recipient.

**Exports.** PowerPoint is editable. Worksheets, flashcards and storybooks are printable. The public sample and saved-draft reader can render silent storyboards. In the signed-in LMS, **Voice & video** also makes narrated films: the provider generates a private WAV per approved scene, then the browser mixes the recordings with captions at the measured audio durations. An educator can download a film or explicitly share the reviewed file with a published course, and withdraw it later. The presenter in **Live conversation** is a separate LiveAvatar session.

**Dashboard.** Staff metrics in Learning use courses, members, quizzes and progress already authorized for the signed-in account. Teachers see their accessible records; a lack of records displays as zero. The public dashboard is a separate resettable example. The edition chart compares 14 named Tejasvi workflows. Changing a chart selection never changes an account’s permissions.

**Maintenance.** Tool and output definitions live in `lib/atelier.ts`; the homepage and signed-in studio share the output catalogue, resource reader and exporters in `components/workshop`. Existing AI Studio drafts remain readable without a kit. The original artwork and generation notes are listed in `docs/studio-art.md`. Build with `npm run build`; regenerate the offline file with `npm run preview:homepage`.
