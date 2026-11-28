---
name: audit-notary-design
description: Design and change the look or the interaction of the Audit Notary web app — tokens, components, page templates, views, charts, copy — within its visual language "The Register" (sheet and margin, the seal, the daybook, the file-drawer columns). Covers the rules a change must keep, the copy rules, the accessibility checklist and the screenshot-critique loop against the scenario mock. Use before writing or restyling any part of web-app/src.
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, Skill
---

# Audit Notary Design Skill

The reasoning is `doc/concepts/visual-design.adoc`; this skill is how to work with it. The structure of the app (shell,
templates, closed vocabulary, tag grammar, column engine) is that of `pm-web-app`; the look is Audit Notary's own.
Read the concept first, then the component you are about to change.

## 1. Before you design

1. Name the document and its moment: whose record is it, who fills it in, who signs it, what is at stake. The design
   follows from the subject (a workshop, a release, an incident under a deadline), never from a template.
2. Find the existing piece. `web-app/src/lib/forms/` is the form kit (`SchemaForm`, `DateTimeField`, `DataTable`,
   `CatalogPicker`, `PersonPicker`, `AsciiDocField`, `DocumentRefField`); its tests sit beside it and read the mock's
   `workshop` profile. `web-app/src/lib/components/` is a closed vocabulary: extend a component before adding
   one, and add one only with its test in `components.test.ts` or a test file beside it. `web-app/src/lib/views/documents/`
   is the generic documents lens (`DocumentSheet`, `TransitionBar`, `ConflictPanel`, `RevisionPicker`,
   `NewDocumentSheet`, `DocumentListColumn`); a lens that edits a document uses the document controller
   (`web-app/src/lib/documents/`) and builds its sheet the same way. A lens that releases a document uses
   `ReleaseFlow` (`documents/ReleaseFlow.svelte`), which every category shares; it hands in its words, its stage (the
   seal), its record and the way a value is drawn, and never builds the release page again.
   `web-app/src/lib/views/catalogs/` is the Catalogs lens (`CatalogsView`, `EntryListColumn`, `EntrySheet`,
   `ServiceNeeds`): an entry is a sheet over `SchemaForm` with the category `catalog` and the catalog as the kind, and has
   no draft (the last save wins); a retirement is a destructive act behind a confirmation, in the margin. The mark of an
   entry is `KindMark` kind `entry`. A field that names several catalogs (`x-catalog` as an array) is a `CatalogPicker`
   whose `Select` groups the options by catalog (`SelectOption.group`).
   `web-app/src/lib/views/directory/` holds the pages of the directory (`PersonsView`, `ImportView`, `ProfileView`,
   `MembershipsEditor`) and `web-app/src/lib/directory/` what they know (limits, words, errors by pointer). A page of
   facts read row by row is a `GridTable` (the first cell a row head, every further cell with `data-label`, so a narrow
   column stands as a block of labelled lines); files come from a `FilePicker`, an act that opens the system's dialog
   and never a raw `<input type="file">`. A confirmation that is due is the shell's `ConfirmationNotice` (an information
   notice with a link, never a gate). The pages are `WizardPage` (import, profile) and `DashboardPage` (persons); the
   erasure of a person and every other destructive act asks first in a `Dialog` that names the person by name and says
   that it cannot be undone.
   `web-app/src/lib/views/samm/` also holds the forms of the SAMM completion: `NewScopeSheet` and `NewAssessmentSheet` (a new
   object is a sheet whose first save creates it; nothing is stored before, and `LeaveGuard` from `lib/documents/` asks
   before the page is left), `TargetsEditor` (the practices by business function as a `GridTable` of a `Select` and a date
   field with `labelHidden` labels, one component for the form of a new scope and for the roadmap in the scope sheet) and
   `EvidenceEditor` (a `DataTable` with a dialog over a copy, removal asked first). The roadmap of a scope has no draft:
   the document controller takes `drafts: false`, and the status says "Not saved for everyone yet". A released assessment is
   frozen; the way on is the primary link *Start a new assessment* to `/samm/{scope}/new`, never a button that writes.
   `web-app/src/lib/views/reports/` holds the lens Reports (`ReportsView`, `SammTrendView`, `SammCompareView`,
   `ThreatEvaluationView`, `RiskRegisterView`) on `ReportPage` (a `DashboardPage` with the breadcrumb; no page draws a
   second way back) and `ThreatEvaluationTable`, which the lens Threat models draws as well; what they know is in
   `web-app/src/lib/reports/` (addresses, statuses, the arithmetic of the charts). A report only reads: its controls choose
   what is read, and every chart carries its figures as direct labels and as a table under it. `SeriesChart` (several lines,
   one slot of the series colours and one marker shape each, a legend, the end value of every line as a label) and
   `Dumbbell` (the same measure at two moments: ring, filled dot, bar, the scores and the change in words) are the two
   charts; a sixth series is a table row, never a sixth colour.
   `web-app/src/lib/views/threats/` holds the lens Threat models (`ThreatModelsView`: evaluation › service › model on
   `TriagePage`; `EvaluationColumn`, which is `ThreatEvaluationTable` with `offerNew`, and `ServiceColumn`; `NewModelSheet`, the
   address `/threat-models/{service}/new`: `RecipeChoice` without a recipe, `RecipeWizardSheet` with one;
   `ThreatModelReleaseView`, the release on `ReleaseFlow`) and what it knows is in `web-app/src/lib/threats/` (addresses, ids, untreated, the review date, errors by row,
   the diff by threat; `recipe.ts` and `wizard.svelte.ts` for the wizard). The sheet (`ThreatModelSheet`) has two parts and so two document controllers, one for the data of the
   document (owner, review date) and one for the file of the model; "Save for everyone" saves both, and a list of the file
   (`/threats`, `/mitigations`) is changed and sent as a whole, a conflict decided per list (`ConflictPanel describe`).
   `ThreatTable` and `CountermeasureEditor` are `DataTable` editors with a dialog over a copy (`DataTable` takes `addLabel` and
   `rowName` where a page holds more than one table); a threat that was transferred is shown as a link and never changed
   here (the editor has no control for it), yet its reference is carried back unchanged in the whole `/threats` list that a save
   sends, so that an edit of another field does not drop the link; the diagram is an `<img>` of a checked `data:image/svg+xml;base64,` URL with a text alternative, never markup.
   The recipe wizard is a sheet in the last column of the lens, not a page of its own: `Stepper` (a component of the closed
   vocabulary: the steps as a numbered list, the reached ones as acts that go back, the current one `aria-current="step"`, a
   count and the current step only on a phone) over the steps and one last page, *Review and create*; a step is its heading
   (it takes the focus, the change is announced politely), the recipe's guidance (`AsciiDocView`, set off by a hairline, never
   a box) and the form of what it fills (`SchemaForm` cut to the member and `untitled`, so that the title of its only section or the caption of its only table is not
   drawn under the step's own heading, `ThreatTable`, `CountermeasureEditor`). The primary
   act is *Next step*, on the last page *Create threat model*; *Back* writes nothing; the draft is kept when the person goes
   on and the status says *Saved for you at …*; leaving with changes that are kept nowhere asks (`LeaveGuard`); the create goes
   through `StepUpHandler`. A text of a recipe is its own data in the language of the interface, never a catalogue key.
   `web-app/src/lib/views/incidents/` holds the lens Incidents (`IncidentsView`: years › year › incident on `TriagePage`;
   `YearsColumn`, `YearColumn`; `IncidentSheet`, the sheet) and what it knows is in `web-app/src/lib/incidents/` (addresses, the tabs
   and the clock rows worded, the notices as rows, the kind of a part's form `incident.<part>`, `stageActs.svelte.ts` for completing and
   reopening a stage, `history.ts`, `report.ts`). The sheet has one document controller for the title (part `data`) and one for
   each stage, all through the sheet's one `StepUpHandler`, and "Save for everyone" saves every part that changed; a completed stage
   is read-only (`frozen` for its controller), the title never is. Two components belong to it: `StageTabs` (the stages as an
   ARIA tab list: status in words, a stage that does not apply greyed with its condition, the marker of a stage signed off before an
   earlier one was reopened, a box for a conflict) and `DeadlineClock` (sober: the rule, its basis, the state in words, the due time,
   how long is left or overdue; a deadline that needs the person, missed and never sent, is the only box; no mascot, no gold, no
   gauge, no motion). A stage panel is the guidance, who signed it off, the form of its part (`SchemaForm` over `partSchema`, the kind
   `incident.<part>`, never the `completion`), what only this stage has (the title and the derived protection needs of the triage,
   `NotificationsTable` over the notices), and `StageActBar`: *Complete stage* / *Reopen stage* act on the saved part, ask to save first,
   say why they are disabled, and list the missing fields and the stages to complete first on a refusal. The report is `ReportPreview`:
   read on demand, rendered by level-2 section, with the note that it is a preview and in English. `TransitionBar` takes `reasonFor`
   for the reasons only a lens knows (the incident is not submitted while a stage is open).
   The release of an incident is `IncidentReleaseView` on `ReleaseFlow` (the diff by stage from `incidents/release.ts`, the
   deadlines that are still a duty as a `DeadlineClock` in the flow's `since` section, the clock stopped after the release; the
   open deadlines never block it; `explain` tells `STAGES_OPEN` with a link to the tab of every stage; `mascot={false}`, because an incident's
   deadlines weigh on the page, and `shortLabels`, so that the long values of a form's fields get the room). `NewIncidentSheet` is the
   form of `/incidents/{year}/new` (title and awareness as two `SchemaForm`s, the create through the step-up handler, `LeaveGuard`).
   `web-app/src/lib/views/isms/` holds the documents of the lens ISMS (`IsmsView`: types › documents › document on `TriagePage`;
   `TypesColumn`, `DocumentsColumn`; `IsmsDocumentReleaseView`; `DocumentCompareView`, the comparison of two releases on
   `DashboardPage`) and what it knows is in `web-app/src/lib/isms/model.ts` (the category, the addresses, the releases and their pairs,
   the review date). The category `isms` is not a generic one, so the lens hands `ISMS_DOCUMENTS` and its own addresses to the generic
   pieces: `DocumentSheet` takes `addressFor`, `releaseAddress`, `moreFacts` (the review date) and `aside` (the link to the
   comparison), `NewDocumentSheet` takes `newAddress` and `backAddress`, and `DocumentReleaseView` takes a `lens`. The record of changes
   is `DiffRecord` (`documents/`), which the release page and the comparison share; a lens that shows changes uses it, never a list of
   its own. The review date is a fact in words, never a coloured mark.
3. For a chart, use the five series colours in model order (`--color-series-1` … `-5`); they are validated for
   colour-vision and normal-vision separation against both sheet colours (`#ffffff`, `#161d2e`). A new chart colour
   needs the same validation before it lands: with the validator of the `dataviz` skill where your agent has that
   skill, otherwise with a colour-vision-deficiency simulation of the chart and the contrast test in `tokens.test.ts`.
   Never ship one unvalidated.
4. For a page in a new lens, decide which template it is (`DashboardPage`, `TriagePage`, `ObjectPage`, `WizardPage`)
   and which levels the chain has.
5. A page of the access flows (`/login`, `/signed-out`, `/login-problem`) stands outside the shell: it is a `WizardPage`
   in the `GateFrame` (the name above one column on the desk, no rail, no session), with the notice of local test
   accounts when the installation has them. It is built, not designed again.

## 2. The rules of the register

**Surfaces**

- A document is a `Sheet` on the desk. Its record is on the left. The `margin` holds provenance: people, the signed
  history, the release. The `status` holds what must stay in reach: the save state and its act.
- No cards inside a sheet, no sheet inside a sheet. Sections are divided by space and hairlines, not by boxes.
- List columns lie on the desk; only the object column holds a sheet.

**Colour** (only through `tokens.css`; a literal anywhere else fails the build)

- Signature ink (`--color-brand`) is the one accent: the primary act, the selection, the focus ring, links.
- Seal gold (`--color-seal`) is for seals only: the released seal, the sealed state label, a release line in the
  history. It is never a status colour and never a decoration. There are two seals and no third: `MaturitySeal` (the
  rosette of a SAMM assessment) and `ReleaseSeal` (the ring around the version, for every document without a rosette).
  `ReleaseSeal` appears only after the release; before it the release view shows the facts and the changes.
- Attention, danger, success and running keep one meaning each, and colour never speaks alone: every state has its
  word, every figure its text.
- The rail is dark in both themes. On the rail use `--color-rail-*` and `--focus-ring-rail`.
- The five SAMM business functions are `--color-series-1` … `-5`, always in model order.

**Type**

- Source Serif 4 (`--font-serif`) is for the record: titles at `--text-display`, section heads, question texts, figures
  of scores, the daybook's numerals.
- Inter is for everything around the record: controls, labels, meta.
- No labels in capitals, no `A · B · C` meta strings (use a `<dl>` of terms), no arrow appended to a link text.
- Monospace (`Chip`) only for what is compared or copied: tags, pseudonyms, blob ids.

**Tags** (the grammar of `pm-web-app`)

- A box (`ReasonBadge`) means "needs you".
- A dot (`StatusLabel`) means "for information".
- At most one of each per row.

**Acts**

- One primary act per screen, on the object.
- A confirmation is asked by the step-up handler (`src/lib/stepup/`: `StepUpHandler` and `StepUpDialog`), never by a view
  of its own. A view that sends a request which can ask mounts the dialog and sends the request through `run`; it keeps
  only the transition's own refusals.
- An act that cannot be taken now stays focusable and says why (`Button disabledReason`).
- Navigation that is the screen's act is a `Link look="primary"`.
- A step of a workflow acts on the saved document: with unsaved changes the sheet says so and offers "Save for everyone,
  then <step>"; a step is never sent over changes only the person has. The step that is the release reads "Release".
- Destructive acts live behind a confirmation. The two kinds keep their own words: *retire* (a catalog entry stays for
  what refers to it; German *stilllegen*) and *erase* (a person's entry is gone; German *löschen*). A row of a table
  offers such an act as a quiet button (`variant="ghost"`): the confirmation is the weight of the decision.
- A preview reads in the future: counts and lists of a check that writes nothing say *to create* and *to update*, never
  *created* (the result says that). The notice of a preview and the introduction of the page never say the same sentence.
- The release view reads the act "Release" and nothing else; that the person confirms their identity once more is a
  line in the margin. A refusal of the release is told by `ReleaseFlow` once for every category (changed since the
  review, released meanwhile, mandatory fields missing, the Git server); a lens adds no notice of its own.
- In the release view a list or a row that is new or gone is read row by row and field by field, as the form reads
  it (a person by the name, never the pseudonym); the record folds once the release is made; and the margin promises no
  release (the seal, the identity line) where the act is disabled.
- The search of the command palette offers an address only after the canonical-address check (`checkReturn`); the
  server's text is data, drawn as text.

**Motion**

- Only in answer to an act, plus the one orchestrated moment: the seal pressed on a release (`--duration-seal`), the
  same press for `MaturitySeal` and `ReleaseSeal`.
- Everything collapses to 0 ms under reduced motion.

**The mascot**

- Only on calm surfaces: an empty Due list, a finished release, the signed-out page.
- Never in incidents, deadlines, warnings or errors.

**Forms** (the form kit, `web-app/src/lib/forms/`, AUN-WEB-4)

- A document is edited and read through `SchemaForm`; a lens never writes a field of its own. A field the kit lacks is
  added to the kit (`schema.ts` chooses the component by the ordered rules), not to a view.
- Texts of a field are catalogue keys `category.<category>.<kind>.field.<path>` (`.help`, `.option.<value>`) of the
  category's messages, never the schema's `title`. A field without a key shows its property name on purpose.
- A mandatory field is marked with the word *required* after its label, never with a colour or an asterisk, and is no
  error before a transition (`showMissing` says it once a transition was refused). A format error is advice ("You can
  still save"); the server's verdict replaces the browser's errors.
- Marks are the tag grammar: a dot (`StatusLabel`) for information (*retired*, *not yet bound*, *former member*), a box
  (`ReasonBadge`) for what needs the person (*not found*, *unknown person*, a row with an error). A person is shown by
  the name, or for a former member by team and role, never by the pseudonym, except as the `Chip` of an unknown one.
- A control that holds a list (`DataTable`) edits a row in a dialog over a copy: nothing changes until "Apply changes";
  removing a row asks first; a limit of the list hides or explains the act, it never leaves a dead control; on a narrow
  column a row stands as a block of its columns, so nothing scrolls sideways.
- A `Dialog` is at most as tall as the room under its top margin (`max-block-size` from the window height, the margin and one
  `--space-4`) and scrolls inside; a dialog with a long body (a row editor) adds no limit of its own. A link or a summary that
  stands in a table or a record is a target of 44 px on a phone (`min-block-size` in the phone media query).
- The preview of AsciiDoc is the server's, cut to the allow-list and drawn with the app's own elements (`SafeNodes`);
  `{@html}` stays banned. An unavailable renderer costs the preview only.
- Read-only: the same labels, sections and hints, values typeset in the serif as text; the marks belong to the reading.

**CSP and markup**

- No `style` attribute and no `{@html}`. Set CSS custom properties with `style:--name`.
- No raw `<button>`, `<a>`, `<input>`, `<select>` or `<textarea>` in views, templates or routes.

## 3. Copy

- Every text is a catalogue key in `messages_en.properties` **and** `messages_de.properties`
  (`web-app/src/main/resources/META-INF/audit-notary/messages/`). Write the German yourself, in the same plain register
  as the English. Never leave a literal in markup: `npm run lint` fails.
- The voice is a notary's office: plain, calm, accountable. Say what happened and what to do; no apology, no jokes.
- Buttons say exactly what happens ("Save for everyone", "Release"), and the result repeats the
  verb ("Saved for everyone at 09:52").
- A control names the domain act only. A mechanism (MFA, step-up, password, token) is never a label: where a
  confirmation is needed, a line beside the control says so in domain words ("You confirm your identity once more
  before the release."), whatever the method (AUN-WEB-6).
- "Saved for you" (draft) and "saved for everyone" (signed commit) must never be confused.
- Never use the words *notarised* or *certified* for what the app does.
- Texts of a document type's model (SAMM answers, quality criteria) are data served with the model, not catalogue
  keys.

## 4. Accessibility checklist

Check each item before you hand a change over.

- [ ] Every new colour pair is in `tokens.test.ts` and passes 4.5:1 for text, 3:1 for graphics and field boundaries,
      in both themes. One documented exception: four of the five chart series stay below 3:1 on the white sheet. A
      chart that uses them carries every value as text (direct labels) or a table as well, so no value depends on
      telling a colour apart (`doc/concepts/visual-design.adoc`, Tokens).
- [ ] Every control is reachable and operable by keyboard. Arrow keys stay with radio groups; shortcut keys are an
      addition, never the only way.
- [ ] The accessible name contains the visible label (WCAG 2.5.3). A link whose visible text is an abbreviation gets
      the abbreviation out of the link, or into the start of its name.
- [ ] A change the person did not cause (a save by someone else, a new object) is announced politely; focus moves to
      a new object's heading.
- [ ] A chart has a legend for two series or more, direct labels where few, and the same figures as a table.
      A chart is drawn at the width it has on the page (`bind:clientWidth`), never scaled down as a whole, so its text keeps
      its size on a phone; the first and the last axis label stay inside the figure.
- [ ] Forced colours: the component still shows its state (`@media (forced-colors: active)`).
- [ ] Phone (390 px): nothing scrolls sideways, targets are 44 px (a link in a stacked row or in a head gets its
      padding, not a box), the status of a sheet stays above the record.
- [ ] Notices of a page of sections stand in the width of the sections; a name of a table row is never broken between its
      words, an id or a reference (`Chip`) is never broken in the middle; the mascot is gone while a refusal or an error
      shows; a radio group's target is its label (44 px on a phone), not the 13 px glyph.
- [ ] A section whose list is empty says so under its heading (no heading over nothing); the act that removes a row names
      the row in its accessible name and stands under the field it removes, not beside it.
- [ ] A sentence is said once on a screen: a read-only sheet says so in its status and not again in a notice, and the
      reason of a disabled act is not the sentence of the status beside it.
- [ ] A cell of a `GridTable` that holds several lines (a date and its note, a badge and a date) is one element
      (`<span class="cell">`): on a stacked row every child of a cell is an item of its own and a second one would
      flow under the label instead of standing in the column of the value.
- [ ] A chart of four or five lines has the taller figure and its moved labels a leader that runs sideways; under forced
      colours the lines keep a dash of their own per slot.
- [ ] A section that states a negative about a set ("every service has a model") is not drawn when the set is empty.
- [ ] German: no clipped or overlapping text with the longer words.

## 5. The screenshot-critique loop

Run the app against the scenario mock and look at every screen you touched.

```bash
# Terminal 1: the mock (in the background), then the dev server (in the foreground).
web-mock/start.sh -s workshop                 # port 7420; profiles: workshop, read-only, degraded, empty,
                                              # first-login, no-rights, release (states review, password,
                                              # wrong-password, changed, too-many-logins, released); workshop also
                                              # has saved-by-other, conflict, session-replaced, session-ended;
                                              # flow profiles: local (own login page), login-trouble;
                                              # directory: catalog-admin (import, persons, erasure), first-login#candidates,
                                              # workshop#confirmation-due
(cd web-app && npm run dev)                   # http://127.0.0.1:5173, keeps running

# Terminal 2: switch the profile or the state while the dev server runs.
curl -X POST http://127.0.0.1:7420/mock/scenario -d '{"scenario":"release#password"}'
```

Capture each screen at 1440, 1024 and 390 px, light and dark, English and German:

- With Claude in Chrome when it is connected.
- Otherwise with a short Playwright script from `web-e2e/node_modules` that logs in through
  `/api/v1/auth/login?return=<path>` and takes full-page screenshots. Keep the script in `.plan/temp/`. The pages
  outside the shell need no login: open `/login` (profile `local`), `/signed-out` and `/login-problem?reason=` directly.

For every screenshot ask:

1. Is the record the most important thing on the screen? Does anything compete with it?
2. Is the seal or the primary act the only bold thing? Remove one accessory.
3. Does every state have its word? Would the screen still work in greyscale?
4. Does anything read like a template default rather than like this subject (cards for everything, a gradient,
   all-caps eyebrows)?
5. Is the copy plain, and does the button say what happens?

Fix what you find and capture again. Full-page captures show the sticky rail and bottom bar cut off at the first
viewport; that is the capture, not the page.

## 6. Verify

```bash
# From the repository root; each module command runs in a subshell, so the next line starts from the root again.
(cd web-app && npm run lint && npm run check && npx vitest run --coverage)  # 80 % thresholds
(cd web-e2e && npx playwright test)                                         # axe on every view, both themes
./mvnw clean verify                                                         # everything, as CI runs it
```

A new view also gets:

- a row in `web-e2e/tests/theme-readability.spec.js`;
- its flows in a spec of its own;
- its data in a `web-mock` profile, with large or shared answers as `body_file` under `scenarios/data/`.
