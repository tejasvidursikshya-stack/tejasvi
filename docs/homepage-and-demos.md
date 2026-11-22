# Maintaining the Tejasvi homepage and demo

There are two visitor paths. **Try the demo** goes directly to a task that can be completed without an account. **Request a walkthrough** sends a contact request to the platform owner. Neither path creates an institution or grants workspace permissions.

| Area | Source of truth | How to change it |
| --- | --- | --- |
| Banner audiences, photography and copy | `components/campus-home/content.ts` | Edit the current slide records and image assets. The banner uses the original proportions in its Full photo viewer and art-directed crops on the page. |
| Handwriting | `components/campus-home/handwriting.tsx` and `app/campus-banner.css` | The accent phrase is real pen geometry drawn in sequence. Unmapped characters fall back to legible italic text. Keep the audience message short. The accessible heading always contains the full text. |
| Demo activities | `components/campus-home/demo-content.ts` and `demo-hub.tsx` | Each task has sample inputs, a visible change in the dashboard, a recent-activity entry and a reset. Keep them aligned with workflows the product supports. |
| Walkthrough intake | `walkthrough.tsx`, `lib/demo-requests.ts`, `lib/demo-options.ts`, and the demo request API routes | Keep required fields short. Server validation, consent, retries and access checks are enforced separately from the form. |
| Public presentation styles | `app/campus-home.css` | This file lists the styles used by both Next.js and the offline generator. Add a local stylesheet here once. |
| Owner inbox | `app/workspace/demo-requests/` | Only the platform Super Admin can read inquiries or change their status. Filter by status; the inbox shows 20 per page. |

## Data and follow-up

The public sample workspace keeps changes in React state for the current visit. Do not connect it to an active institution, add shared demo passwords or turn sample submissions into business records. AI Creator examples likewise stay local. The authenticated AI service keeps its existing provider requirements.

Only an actual walkthrough submission writes to the `demo_requests` table. The form records name, contact email, organization, type, optional interests, consent time and status. A request identifier prevents duplicate inserts on network retry. The public endpoint accepts submissions and exposes no listing. The normal Campus backup includes the table. Handle contacts under the same access and retention practices as your other enquiries.

Check **My workspaces → Demo requests** during the working day. Agree a time with the contact, then mark the request **Contacted**; mark it **Closed** when follow-up is complete. The form does not promise a time slot and sends no automatic notifications. If scheduling or email is added later, distinguish an enquiry from a confirmed appointment and report confirmation only after the provider accepts it.

## Releases

Run `npm run build` and `npm run preview:homepage` with Node 24+ and the locked dependencies. The latter writes `build/homepage-preview.html`. The HTML uses the same React components as the app; the offline flag disables live intake and supplies clearly marked sample details. If you add imagery, include the new asset names in `scripts/homepage-preview.mjs`.

Before handing a release to a school, try all three tasks including a validation error, inspect the Activity view, and open the full photo at phone and desktop widths. With reduced motion, the text should be readable immediately. On a test installation send a walkthrough request, retry it, and check that just one item appears for the Super Admin and is invisible to an institution admin. Confirm the offline copy never claims to send.

Database evolution uses numbered, checksum-verified files under `database/migrations`. Never edit a migration already applied to an installation. Normal startup verifies the installation identity and applies pending migrations before serving. Migration 018 adds the request inbox and does not seed user or campus records. Test updates on a backup or test installation; an interrupted migration stops with a diagnostic rather than guessing at a repair.


The dashboard and edition chart are shared with the real LMS; the public data source stays isolated. For the illustrated Creator collection, educator tools and learner publication, see [Creator Studio](creator-studio.md).
