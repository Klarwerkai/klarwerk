// GRUNDWÖRTERBUCH `en` — I18N-AUFTEILUNG (Aufnahme 20260922, zentrale-module-aufteilen).
//
// Dieser Block stand bis zur Aufteilung in `apps/web/src/i18n.ts`. Er ist Zeile für Zeile hierher
// verschoben; kein Schlüssel und kein Wert ist geändert (Beleg:
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Neue Texte gehören in ein Textmodul
// unter `apps/web/src/texte/` (docs/i18n-textmodule.md), nicht hierher.
import { lesevarianteTexteEn } from "../lib/lesevariante";
import type { de } from "./de";

const en: typeof de = {
  // SCRUM-488: first tranche of contextual help texts (mirror of the DE keys).
  "ask.help.sources.title": "Why only sourced answers?",
  "ask.help.sources.body":
    "Klarwerk answers only from your own knowledge objects — never from general model knowledge. For every answer you see which sources carried it and what state they are in. If the basis is missing, it says so honestly instead of guessing. Check the cited sources before relying on them.",
  "dup.help.detection.title": "How duplicates are detected",
  "dup.help.detection.body":
    "“Text-identical” is found by the heuristic without AI; “likely” is judged by the model on content. The decision is yours — and it records nothing but a closing reason: it changes neither of the two objects, deletes neither, both stay.",
  "extpage.help.scope.title": "What external search may do",
  "extpage.help.scope.body":
    "External hits are research support, not verified knowledge: nothing is imported automatically or validated by colleagues. If the admin has disabled external lookup, the area stays empty.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "A new version of the app is available — please reload the page (Cmd+R or Ctrl+R).",
  "version.neu.hinweis": "New version available",
  "version.neu.neuLaden": "Reload",
  "nav.group.workspace": "Workspace",
  "nav.group.quality": "Quality & Upkeep",
  "nav.group.control": "Control",
  "nav.group.advanced": "Advanced",
  "gliederung.arbeiten": "Workspace",
  "gliederung.qualitaet": "Quality",
  "gliederung.verwaltung": "Administration",
  "gliederung.persoenlich": "Personal and help",
  "nav.start": "Home",
  "nav.tasks": "Open tasks",
  "nav.capture": "Capture Knowledge",
  "nav.ask": "Ask",
  "nav.library": "Library",
  "nav.wissensnetz": "Topic map",
  "wissensnetz.kicker": "Knowledge network",
  "wissensnetz.title": "Topic map",
  "wissensnetz.karte.label": "Topics and where they overlap",
  "wissensnetz.karte.alt": "Topic map with {{count}} topics",
  "wissensnetz.knoten.alt": "{{thema}} — {{count}} visible knowledge objects, select topic",
  "wissensnetz.farbe.belegt": "released and sourced",
  "wissensnetz.farbe.freigegeben": "released, no source",
  "wissensnetz.farbe.offen": "under review",
  "wissensnetz.legende.ubiquitaer":
    "Dashed outline: appears in the majority of the visible stock and therefore gets no edges.",
  "wissensnetz.legende.keineKanten":
    "In this stock no released knowledge object shares two of these topics — that is why no lines are shown.",
  "wissensnetz.legende.kantenUnterdrueckt":
    "A released knowledge object does link two topics here — but at least one of them appears in the majority of the visible stock and therefore gets no lines.",
  "wissensnetz.alle.schalter": "All topics ({{count}} more)",
  "wissensnetz.alle.abgeschnitten": "This list is shortened.",
  "wissensnetz.leer": "No keywords are assigned in this stock.",
  // JOB 3052 D6 — mirror of the DE keys, see the notes there.
  "wissensnetz.legende.groesse": "Size = visible knowledge · edge = released together",
  "wissensnetz.leiste.alt": "About the topic {{thema}}",
  "wissensnetz.leiste.zaehlung": "{{frei}} released knowledge objects · {{pruefung}} under review",
  "wissensnetz.leiste.status.validiert": "released",
  "wissensnetz.leiste.status.offen": "under review",
  "wissensnetz.leiste.alle": "Open all {{count}} objects",
  "wissensnetz.leiste.oeffnen": "Open in the library",
  "wissensnetz.leiste.leer": "Nothing on this topic is visible to you.",
  "wissensnetz.leiste.fehler": "The objects for this topic could not be loaded.",
  "wissensnetz.stand.fehlgeschlagen": "As of {{stand}} · refresh failed",
  "wissensnetz.keineAntwort": "No answer from the server yet.",
  // JOB 3067 V4 — the read-off card below the network. Every label carries the word "visible",
  // each one on its own: a reader takes in a single line, not the card title above it.
  "wissensnetz.metrik.titel": "Visible stock",
  "wissensnetz.metrik.objekte": "Visible objects",
  "wissensnetz.metrik.ohneThema": "Visible objects without a keyword",
  "wissensnetz.metrik.beitragende": "Visible contributors",
  "wissensnetz.metrik.hinweis":
    "What was counted is what is visible to you. Anything you may not see was removed before counting — what these numbers mean is yours to decide.",
  "wissensnetz.metrik.ohneThemaHinweis": "There is no entry point into the library for these.",
  "wissensnetz.metrik.themenTitel": "Topics by visible contributors, the fewest first",
  "wissensnetz.metrik.zeile.objekte": "{{count}} visible objects",
  "wissensnetz.metrik.zeile.beitragende": "{{count}} visible contributors",
  "wissensnetz.metrik.zeile.beitragendeMindestens": "at least {{count}} visible contributors",
  "wissensnetz.metrik.mehr": "Show {{count}} more topics",
  "wissensnetz.metrik.weniger": "Hide the further topics",
  // JOB 3070 V6 — the reading path, mirror of the DE keys; see the notes there.
  "wissensnetz.lesen.gruppe": "How the topic map is shown",
  "wissensnetz.lesen.netz": "Network",
  "wissensnetz.lesen.lesen": "Reading",
  "wissensnetz.lesen.ubiquitaer":
    "Appears in the majority of the visible stock; co-occurrence is therefore not reported for it.",
  "wissensnetz.lesen.zusammen": "Appears together with {{themen}}.",
  // JOB 4155 WG-LUECKEN — mirror of the DE keys; see the reasoning there.
  "wissensnetz.lesen.verknuepfung":
    "{{verknuepft}} of them have a set relationship, {{unverknuepft}} do not.",
  "wissensnetz.verknuepfung.grundsatz":
    "If no relationship is set for an entry, that does not mean it has been checked and found free of contradictions — it only means that nobody has set a relationship.",
  "wissensnetz.verknuepfung.ausgelassen.kein-kantenport":
    "The set relationships were not queried for this overview; no figure for them is shown here.",
  "wissensnetz.verknuepfung.ausgelassen.zu-viele-objekte":
    "The set relationships were not counted for this stock because too many entries are visible; no figure for them is shown here.",
  "wissensnetz.lesen.zustand": "State: {{wort}}.",
  "wissensnetz.lesen.nichtInListe":
    "The drawing shows {{count}} topics that this list has no row for.",
  "nav.external": "External knowledge",
  "nav.validation": "Validation",
  "nav.conflicts": "Conflicts",
  "nav.duplicates": "Duplicates",
  // SCRUM-486 E: sidebar badges with meaning — count + kind (tooltip/aria-label).
  "nav.badge.tasks": "{{count}} open tasks",
  "nav.badge.loading": "Loading count …",
  "nav.badge.error": "Count failed to load – try again",
  "nav.badge.stale": "Count outdated – refresh failed, try again",
  "loadstate.error.title": "Couldn’t load.",
  "loadstate.error.retry": "Try again",
  "loadstate.stale": "Outdated – refresh failed",
  "nav.badge.validation": "{{count}} awaiting review",
  "nav.badge.conflicts": "{{count}} open contradictions",
  "nav.badge.duplicates": "{{count}} possible duplicates",
  "nav.risk": "Risk & Gaps",
  "nav.lifecycle": "Lifecycle",
  "nav.analytics": "Analytics & Audit",
  "nav.admin": "Admin",
  "nav.output": "Reports",
  "nav.import": "Import & Sources",
  "nav.graph": "Knowledge Graph",
  "nav.capital": "Capital Views",
  "nav.help": "Help",
  "nav.profile": "Profile",
  "role.viewAs": "View as role",
  "role.previewNote": "Preview as {{role}} — you stay Admin.",
  "role.backToAdmin": "Back to admin view",
  "role.stage2": "Advanced modules · Stage 2",
  "role.stage2Hint":
    "Stage 2 are additional modules beyond the core flow — quality assurance, knowledge capital and output formats. An admin enables them.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Expert",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Viewer",
  "role.name.experte": "Expert",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Sign out",
  // JOB 1119 (D-002) — see the German entry.
  "topbar.search": "Search knowledge in the library…",
  "topbar.mobile": "Mobile",
  "topbar.design.classic": "Classic",
  "topbar.design.modern": "Modern",
  "kopfband.suchen": "Search",
  "kopfband.erfassen": "Capture",
  "kopfband.pruefen": "Review",
  "kopfband.navigation": "Main navigation",
  "kopfband.menue": "Menu",
  "kopfband.konto": "Account",
  "kopfband.ungelesen": "{{count}} unread notifications",
  "menue.einstellungen": "Settings",
  "menue.status": "Status",
  "menue.seitenhilfe": "Page help",
  "menue.seitenhilfe.leer": "There is no explanation for this page.",
  // JOB 3669 — page help for the first path: Start → Library → My Tasks → knowledge object.
  // Same three questions in the same order: What is this? What can I do here? What is the next step?
  "seitenhilfe.start.title": "Start page: ask, and see what is waiting",
  "seitenhilfe.start.body":
    "This is the start page: here you ask your knowledge base a question and see what is waiting for you. Type your question into the field — the answer appears on the “Ask” page; the “FOR YOU” card lists your open items, “RECENT” the latest changes in the stock, the link “My drafts” below the field leads to the captures you started (only if you are allowed to capture), and the “…” menu at the top right opens further overviews. Next step: type your question and press Enter — or click a line in “FOR YOU”, it takes you straight to where the matter gets done.",
  "seitenhilfe.bibliothek.title": "Library: the whole stock",
  "seitenhilfe.bibliothek.body":
    "This is your entire knowledge stock. On a wide screen the list stands on the left and the entry you are reading on the right; on a narrow device only one of the two fills the surface — the list without a selection, the entry with one, and the button “Back to Library” at the top takes you back to the list (on a tablet, “Show result list” slides it in as a drawer OVER the entry, “Hide result list” takes it away again). You search with the search field at the top of the header bar; filters, sorting, saved views and export sit in the “…” menu above the list. Next step: click an entry and read it — if the list is empty, the “Capture” button leads to where new knowledge is created, provided your role is allowed to capture; otherwise it says “No access”.",
  "seitenhilfe.aufgaben.title": "Open tasks: what is waiting to be done here",
  "seitenhilfe.aufgaben.body":
    "This is the open work in one place: validations, conflicts, due revalidations, open knowledge gaps and objects that came back to you for rework. The coloured dot shows the urgency (red “Critical”, yellow “Today”, green “Later”), the row of buttons above filters by type and states the count, and the “i” on a line tells you what has to be done there. Next step: click the topmost line — it takes you to where the task gets done, provided that area is enabled for your role; otherwise the way stays closed (conflicts, risk and lifecycle are not open to every role). If it says “Nothing open.”, “What happens next?” shows the possible next moves.",
  "seitenhilfe.wissen.title": "Knowledge object: one statement and its evidence",
  "seitenhilfe.wissen.body":
    "You are reading a single knowledge object — the same surface as the library, only with this entry preselected: on a wide screen the list on the left and its statement with status and source on the right, on a narrow device the entry fills the surface alone and the button “Back to Library” at the top leads to the list. Everything else — sources and attachments, versions, history, comments, conflicts — sits behind the “More” line; if your interface is set to another language and a reading translation exists, it stands at the top, explicitly named as a translation. Next step: read the statement, check status and source, and open “More” when you want to know what it rests on.",
  // JOB 3768 — the fifth page of the same path; see the German entry for what each sentence rests on.
  "seitenhilfe.entwuerfe.title": "My drafts: pick up what you started",
  "seitenhilfe.entwuerfe.body":
    "These are the captures saved as a draft that have not become a knowledge object yet — the same drafts the editor and the workspace show, only in a place of their own; this is not a second draft store. Only your own drafts stand here: they are private, nobody else sees them, not even an administrator. The search field above the list covers only these drafts and no knowledge from the library, “Sort” orders them by when they were saved or by title. Deleted drafts go to the “Recycle bin” below the list: “Restore” brings one back, “Delete permanently” really removes it, and the recycle bin does not empty itself. Next step: click “Resume” on a line — the draft opens in the editor, and unsaved input is asked about beforehand; if the list stands empty, “Capture” leads to where a new draft is created.",
  "menue.weitereBereiche": "Areas",
  "menue.schnellnavigation": "Go to …",
  "menue.darstellung": "Appearance",
  "topbar.design.hint": "Switch the design — changes only the look, not content or input.",
  "topbar.openMenu": "Open menu",
  "topbar.closeMenu": "Close menu",
  "topbar.menuLabel": "Navigation menu",
  "topbar.menuShort": "Menu",
  "topbar.toDesktop": "To full version",
  "topbar.notifications": "Notifications",
  "topbar.notificationsPlaceholder": "No notifications yet. Real source coming (#63).",
  "topbar.reasonerActive": "AI model responding",
  "topbar.reasonerOffline": "No AI model",
  "topbar.reasonerActiveHint": "An AI model responded and was reachable most recently.",
  "topbar.reasonerUnverified": "AI model unverified",
  "topbar.reasonerUnverifiedHint":
    "An AI model is configured, but reachability has not been verified yet.",
  "topbar.reasonerUnreachable": "AI model unreachable",
  "topbar.reasonerUnreachableHint":
    "An AI model is configured but was not reachable recently (e.g. key expired, service down). Calls run deterministically.",
  "topbar.reasonerOfflineHint": "No AI model available — the deterministic fallback is running.",
  "topbar.external.blocked": "Web search: blocked",
  "topbar.external.search": "Web search: allowed",
  "topbar.external.open": "Web search: open",
  "topbar.external.hint":
    "External knowledge lookup (web search) — a SEPARATE axis, not the AI model. It only controls web search / public enrichment, not the reasoner.",
  // Pedi 05.07.: header pill "Which AI am I in?" + country of origin + GDPR confirmation.
  // GDPR: yes ONLY for an internal AI from Europe — everything else is honestly "no".
  "topbar.plain.ki":
    "Shows where the AI that Klarwerk uses does its computing — in-house or at a provider on the internet.",
  "topbar.plain.reasoner":
    "Shows whether the AI is currently answering. “Unverified” only means no answer has come back since startup — it is not an error.",
  "topbar.plain.external":
    "Shows whether Klarwerk may also look things up on the open internet when answering. “Blocked” means: no, it stays with your own knowledge.",
  "topbar.extern.blockiert": "External: Blocked",
  "topbar.extern.frei": "External: Allowed",
  "topbar.extern.freiVertraulich": "External: Allowed, including confidential content",
  "topbar.extern.hinweis":
    "The administrator decides whether content may go to a public AI. Default: blocked.",
  "topbar.kiExternal": "AI runs in the cloud",
  "topbar.kiInternal": "AI runs on your own systems",
  "topbar.kiMixed": "AI runs in the cloud and on your own systems",
  "topbar.kiNone": "No AI",
  "topbar.kiNoneSubtitle": "deterministic fallback mode",
  "topbar.kiDsgvoYes": "GDPR: yes",
  "topbar.kiDsgvoNo": "GDPR: no",
  "topbar.kiExternalHint":
    "Your AI tasks run on a cloud model outside the company — GDPR confirmation is therefore: no. A yes exists only for an internal AI from Europe. Per-task details: Admin → AI.",
  "topbar.kiInternalHint":
    "Your AI tasks run entirely on a local in-house model. GDPR: yes exists only here — and only if the AI originates from Europe. Origin currently derived from the provider identifier; in future the central AI access control will supply it.",
  "topbar.kiMixedHint":
    "Mixed operation: some tasks run on the external cloud AI, others in-house. The strictest level counts — GDPR confirmation: no. Per-task details: Admin → AI.",
  "topbar.kiNoneHint":
    "No AI model is active for any task. Klarwerk is using deterministic fallback mode.",
  // Country of origin of the AI (interim from the provider identifier; later from AI access control).
  "country.us": "USA",
  "country.de": "Germany",
  "country.fr": "France",
  "country.cn": "China",
  "country.unknown": "origin unknown",
  "country.ownSystem": "own system (EU)",
  "topbar.notificationsEmpty": "No notifications.",
  "topbar.notifMarkAll": "Mark all read",
  "topbar.notifMarkRead": "Mark as read",
  // JOB 2709 D4: siehe die deutschen Fassungen oben — Auffangsatz und Handlungsauskunft.
  "topbar.notifSeenFailed": "The notifications could not be saved as read.",
  "topbar.notifSeenReverted": "They remain unread.",
  "topbar.notifOpen": "Open",
  "topbar.notifAssignment": "Review for you",
  "topbar.notifImpact": "Your knowledge helped someone",
  "topbar.notifDuplicate": "Possible duplicate",
  "topbar.notifGapRedacted": "Open knowledge gap",
  "cmd.open": "Open “Go to …”",
  "cmd.close": "Close",
  "cmd.placeholder": "Go to … (⌘K)",
  "cmd.empty": "No match.",
  "cmd.suchfeld": "Search target",
  "cmd.treffer_one": "{{count}} target",
  "cmd.treffer_other": "{{count}} targets",
  "cmd.audit": "Audit log (in Analytics)",
  "toast.dismiss": "Dismiss",
  "page.placeholder":
    "This screen will be built in a later task. App shell, navigation and role logic are in place.",
  "status.entwurf": "Draft",
  "status.offen": "Open",
  "status.pruefung": "In review",
  "status.validiert": "Validated",
  "status.abgelehnt": "Rejected",
  "status.revalidierung": "Re-validation",
  "status.konflikt": "Conflict",
  "quality.preliminary": "Preliminary",
  "quality.reliable": "Reliable",
  "quality.assured": "Assured",
  "evidence.percentSure": "Review status: {{pct}} %",
  "evidence.confidenceLabel": "Review status: {{pct}} of 100",
  "evidence.sourceDate": "Source dated {{date}}",
  "evidence.noDate": "no source date",
  "evidence.noSource": "no source on file",
  "evidence.internalSource": "internal source",
  "evidence.more": "+{{count}} more",
  "ko.read.evidenceZone": "Evidence",
  "ko.read.released": "Release",
  "ko.read.category": "Category",
  "ko.read.responsible": "Responsible",
  "ko.read.version": "Version",
  "ko.read.captured": "Captured on",
  "ko.read.moreDetails": "More details (conditions · measures · tags)",
  "intake.question": "What do you know that others should know?",
  "intake.calming": "Just start writing — Klarwerk helps with the structure.",
  "intake.fieldPlaceholder": "Just start writing …",
  "intake.removeStarter": "Remove type",
  "intake.exampleLabel": "Something like this — but yours.",
  "intake.sampleBadge": "Example",
  "intake.starter.decision": "A decision we made",
  "intake.starter.mistake": "A mistake that's easy to make",
  "intake.starter.howItWorks": "How something really works here",
  "intake.starter.changed": "Something that changed",
  "intake.prefill.decision": "We decided that ",
  "intake.prefill.mistake": "A common mistake is ",
  "intake.prefill.howItWorks": "Here's how it works: ",
  "intake.prefill.changed": "What changed is that ",
  "intake.sample.title": "Pull the emergency stop before any maintenance",
  "intake.sample.statement":
    "Before any maintenance on line 3, pull the emergency stop first and secure it against restart.",
  "intake.live.idle": "I'm listening …",
  "intake.live.checking": "Checking against your knowledge …",
  "intake.live.new": "This is new — nothing on it yet. You're the first.",
  "intake.live.similarLead": "Something similar already exists:",
  "intake.live.similarAsk": "Add to it or start fresh?",
  "intake.live.conflictLead": "Careful — this may contradict:",
  "intake.live.fundort": "Sits in:",
  "intake.live.pruefstand.offen": "not yet reviewed",
  "intake.live.pruefstand.validiert": "Validated",
  "intake.live.openKo": "View",
  "intake.live.unavailable": "Check currently unavailable.",
  "intake.structure.heading": "Klarwerk suggests — tap anything that's off:",
  "intake.structure.title": "Title",
  "intake.structure.category": "Category",
  "intake.structure.source": "Likely source",
  "intake.structure.derived": "derived from your text",
  "intake.structure.categoryPlaceholder": "e.g. maintenance, safety …",
  "intake.done.heading": "Done.",
  "intake.done.checked": "Added to your shared knowledge.",
  "intake.done.credited": "Your name ({{name}}) is recorded as the author.",
  "intake.done.findable": "Whoever asks next finds it — not you.",
  "intake.done.viewKo": "View knowledge object",
  "intake.done.followUp": "Notify me about follow-up questions",
  "intake.submit": "Save knowledge",
  "dcmp.noValue": "No value",
  "dcmp.none": "none",
  "dcmp.trustStatus": "Trust {{trust}}; status {{status}}; required checks {{needed}}",
  "dcmp.tagsCategory": "Category {{category}}; type {{type}}; tags {{tags}}",
  "dcmp.note.koMissing": "No score: at least one knowledge object is missing.",
  "audit.action.ko_created": "Created",
  "audit.action.ko_revised": "Revised",
  "audit.action.ko_rated": "Rated",
  "audit.action.ko_admin_validated": "Admin-validated",
  "audit.action.ko_deleted": "Deleted",
  "audit.action.ko_purged": "Permanently deleted",
  "audit.action.ko_restored": "Restored",
  "audit.action.ko_assigned": "Assigned",
  "audit.action.ko_attached": "Attachment added",
  "audit.action.ko_detached": "Attachment removed",
  "audit.action.ko_author_transferred": "Author transferred",
  "audit.action.ko_category_changed": "Category changed",
  "audit.action.ko_commented": "Commented",
  "audit.action.ko_comment_resolved": "Discussion resolved",
  "audit.action.ko_comment_reopened": "Discussion reopened",
  "audit.action.ko_confidentiality": "Confidentiality changed",
  "audit.action.ko_conflict_review": "Conflict review",
  "audit.action.ko_returned_to_author": "Returned to author",
  // JOB 557 D8 — see the German entry for the finding and the two-name rule.
  "audit.action.ko_returned_to_owner": "Returned to owner",
  "audit.action.ko_source_added": "Source added",
  "audit.action.ko_source_removed": "Source removed",
  // JOB 3384 (UX-26) — s. die Begründung im deutschen Block. Alle drei Sprachen werden bedient
  // (E50d: „ALLES sichtbar DE↔EN"), von Hand geschrieben, nicht über einen Dienst geholt.
  "audit.action.ask_query": "Question asked",
  "audit.action.answer_helpful": "Answer rated helpful",
  "audit.action.ko_document_appended": "Document appended",
  "audit.action.ko_ownership": "Responsibilities changed",
  "audit.action.ko_ownership_role": "Responsibility for one role changed",
  "audit.action.ko_tags_changed": "Tags changed",
  "audit.action.ko_create_followup_failed": "Follow-up after creation failed",
  "audit.action.ko_create_rollback_failed": "Rollback after creation failed",
  // JOB 3140 (UX-11) — see the German block for the reasoning.
  "audit.action.user_role_change": "Role changed",
  "audit.action.user_approve": "Account approved",
  "audit.action.user_account_corrected": "Account details corrected",
  "audit.action.auth_login": "Signed in",
  "audit.action.auth_logout": "Signed out",
  "audit.action.notice_acknowledged": "Notice acknowledged",
  "audit.action.user_oidc_provisioned": "SSO account created",
  "audit.action.user_role_synced": "Role synced with provider",
  "audit.action.user_role_claim_missing": "Provider role claim missing",
  "audit.detail.event": "Event",
  "audit.detail.actor": "Performed by",
  "audit.detail.target": "Affected",
  "audit.detail.targetObject": "Affected object",
  "audit.detail.systemActor": "System (automated)",
  "audit.detail.roleBefore": "Role before",
  "audit.detail.roleAfter": "Role after",
  "audit.detail.notStored": "not recorded",
  "audit.detail.accountGone": "Account no longer exists",
  "audit.detail.nameLoading": "Loading name",
  "audit.detail.nameUnavailable": "Name unavailable",
  "ktype.bauchgefuehl": "Intuition",
  "ktype.best_practice": "Best practice",
  "ktype.lernkurve": "Learning curve",
  "ktype.technik": "Technical",
  "ktype.negativwissen": "Negative knowledge",
  "reasoner.draftLabel": "AI draft · not validated",
  "reasoner.taskInfo.title": "Which AI runs here?",
  "reasoner.taskInfo.cloud": "Cloud AI",
  "reasoner.taskInfo.local": "Local model",
  "reasoner.taskInfo.rule": "Rule-based (no AI model)",
  "reasoner.taskInfo.unknown": "Determining …",
  "reasoner.taskInfo.bodyCloud":
    "This task runs on a cloud AI. Content is sent to the external provider for it.",
  "reasoner.taskInfo.bodyLocal":
    "This task runs on a local model on your own hardware — the content never leaves the house.",
  "reasoner.taskInfo.bodyRule":
    "This task is purely rule-based, without an AI language model — deterministic and with no external transfer.",
  "reasoner.taskInfo.bodyUnknown":
    "The current AI assignment is loading. Details are in the AI administration.",
  "reasoner.taskInfo.modelLabel": "Model",
  "reasoner.taskInfo.dsgvoInhouse": "GDPR-compliant",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Runs in-house (local or rule-based) — the data stays here and is not shared with third parties.",
  "reasoner.taskInfo.dsgvoExternal": "External processing",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Uses an external cloud provider — GDPR compliance depends on the data processing agreement (DPA) with the provider.",
  "ai.unavailable.hint": "AI unavailable — no model is active for this task.",
  "ai.statusUnknown.hint":
    "AI status unknown — the status request failed. The AI answer remains blocked as a precaution.",
  "provenance.original": "originally",
  "uikit.sampleStatement": "Pressure loss on press P2 usually sits at valve V4, not at the pump.",
  "state.loading": "Loading …",
  "state.error": "Something went wrong.",
  "state.staleRefetchFailed": "As of {{zeit}} · refresh failed",
  "modal.close": "Close",
  "nav.guard.title": "Unsaved entry",
  "nav.guard.body": "You have unsaved content in the capture area. What would you like to do?",
  "nav.guard.stay": "Stay here",
  "nav.guard.discard": "Discard and leave",
  "nav.guard.save": "Save draft and leave",
  "nav.guard.unsavableTitle": "Not everything can be saved",
  "nav.guard.unsavableLead": "The draft cannot save this content — it will be lost if you leave:",
  "nav.guard.unsavableHint":
    "Stay here to use or remove it; “Discard and leave” gives it up deliberately. There is no save that takes this content along.",
  // Bug (Pedi 04.07.): error boundary instead of a blank page.
  "error.title": "This view could not be loaded.",
  "error.body":
    "This is a display error, not data loss. Please reload the page. If it happens again, the detail below helps with reporting.",
  "error.reload": "Reload",
  "error.detail": "Detail",
  "state.empty": "Nothing here.",
  "auth.tagline": "Experience knowledge that stays in the company.",
  "auth.taglineSub": "Capture · Validate · Resolve · Answer · Maintain.",
  "auth.title.login": "Sign in",
  "auth.title.register": "Create account",
  "auth.title.waiting": "Almost there",
  "auth.title.setup": "First-time setup",
  "auth.sub.login": "Sign in with your account.",
  "auth.sub.register": "Create an account — an admin approves you.",
  "auth.sub.waiting": "Your account is awaiting approval.",
  "auth.sub.setup": "The first account becomes administrator.",
  "auth.waitingNote":
    "An administrator needs to approve your access. You'll be notified once it's ready.",
  "auth.backToLogin": "Back to sign in",
  "auth.name": "Name",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordRule": "min. 8 characters",
  "auth.passwordRepeat": "Repeat password",
  "auth.passwordMismatch": "The passwords do not match.",
  // WP-VIP2-GATE: self-registration disabled server-side (invite-only operation).
  "auth.registrationDisabled": "Registration is invite-only — please contact your admin.",
  // JOB 4081: the refusal as information instead of a dead end (reasoning at the German entry).
  "auth.registrationClosed.fact":
    "In this installation, access is granted to you. Creating an account yourself is not available here.",
  "auth.registrationClosed.next":
    "Ask someone with administrator rights at your company for an invitation — they will set up your access.",
  // JOB 4105: same situation, but with NO attempt behind it.
  "auth.registrationClosed.upfrontFact":
    "On this installation, access is granted to you rather than created by you. Signing up is not possible here.",
  "auth.registrationClosed.upfrontNext":
    "Contact someone with administrator rights at your company — they will create your account and invite you.",
  "auth.submit.login": "Sign in",
  "auth.submit.register": "Register",
  "auth.submit.setup": "Create admin & start",
  "auth.toRegister": "No account yet? Register",
  "auth.toLogin": "Already have an account? Sign in",
  "auth.toForgot": "Forgot password?",
  "auth.title.forgot": "Reset password",
  "auth.sub.forgot": "We'll send you a reset link.",
  "auth.submit.forgot": "Send link",
  "auth.title.forgotSent": "Email on its way",
  "auth.sub.forgotSent": "Check your inbox.",
  "auth.forgotNote":
    "If an account exists for this email, we've sent a reset link. The link is valid for 1 hour.",
  "auth.title.reset": "New password",
  "auth.sub.reset": "Choose a new password for your account.",
  "auth.newPassword": "New password",
  "auth.submit.reset": "Save password",
  "auth.resetDone": "Your password has been changed. You can sign in now.",
  "auth.resetInvalid": "This link is invalid or has expired.",
  "auth.toSignIn": "Go to sign in",
  "auth.or": "or",
  "auth.ssoButton": "Sign in with SSO",
  // R-0541: the sign-in page when only the company login applies (KLARWERK_SSO_ONLY).
  "auth.ssoOnlyNote":
    "On this installation you sign in with your company account. There is no separate Klara password here.",
  // R-0541 (rework 2): password sign-in is off, but the company login is not set up yet.
  "auth.ssoOnlyMissing":
    "Password sign-in is switched off, but the company login has not been set up yet. Please contact your IT team.",
  // R-0560: the company login via SAML.
  "auth.samlButton": "Sign in with company account (SAML)",
  "auth.ssoUnavailable": "SSO is not configured for this instance.",
  "auth.ssoTitle": "SSO sign-in",
  "auth.ssoBusy": "Completing sign-in …",
  "auth.ssoIncomplete": "Incomplete SSO response. Please sign in again.",
  "cycle.title": "The Klarwerk knowledge cycle",
  "cycle.subtitle": "Knowledge is captured, validated, used and kept current.",
  // SCRUM-290: compact Stage-1 demo/pilot path (Start → Ask → Library/KO detail → Validation).
  "demo.title": "Demo/pilot path in 3 steps",
  "demo.subtitle":
    "A small real walkthrough: ask source-bound, see source/trust/status/version, send unverified knowledge to validation.",
  // SCRUM-301: visible pilot proof line (Start promises, Library/KO detail deliver).
  "demo.proof.label": "Proof line",
  "demo.proof.find": "Find knowledge",
  "demo.proof.usability": "See usability",
  "demo.proof.verify": "Check source/trust/version",
  // SCRUM-308: provenance marker for demo/seed knowledge (context only, not a quality signal).
  "demo.badge.label": "Example data",
  "demo.badge.hint":
    "Example/pilot knowledge from the demo seed. Provenance only — does not replace status, trust, source or validation. Validated stays validated, open stays open.",
  "ko.externalUnchecked.label": "Contains external, unverified knowledge",
  "ko.externalUnchecked.hint":
    "This article incorporates knowledge from a public AI or web search. It is external and unverified — please review it; it does not replace status, trust or validation.",
  // JOB 679 / D2 (K1.2): provenance marker for knowledge captured through the Word add-in.
  // Like the demo badge: provenance ONLY — never a quality or status signal.
  //
  // WHY THIS ONE READS SLIGHTLY DIFFERENTLY FROM ITS GERMAN AND DUTCH SIBLINGS: those enumerate
  // „Status, Vertrauen, Quelle oder Validierung". The literal English enumeration would spell the
  // word t-r-u-s-t, and `tests/app/mega51-sprache-und-rohwerte.test.ts` pins the TOTAL number of
  // such occurrences per language block. That guard is about the German/Dutch DISPLAY VALUES having
  // been renamed (mega52 E2/E3) — English is explicitly exempt in its own reasoning — but it counts
  // a blunt total, so any new English string carrying the word trips it. Rather than edit a guard
  // that lies outside this job's lease, the sentence says the same thing without the token: it names
  // the honest claim („not a quality signal") that the enumeration exists to make.
  "ko.originWordAddin.label": "From Word",
  "ko.originWordAddin.hint":
    "This entry was captured through the Word add-in. Provenance only — it is not a quality signal and does not replace status, source or validation.",
  // JOB 3027 · Station 4: plain wording for the remaining four capture paths.
  "ko.origin.tell": "From telling",
  "ko.origin.studio": "From the studio",
  "ko.origin.expert": "From the expert form",
  "ko.origin.frontdoor": "From the capture form",
  // R-0180/R-2108: taken over from the import review queue by a person.
  "ko.origin.import": "Imported",
  // JOB 3027 · Station 4: the three states per disclosure. „not classified" is a statement about the
  // OBJECT, „not in this response" one about the RESPONSE — merging them forces the reader to guess.
  "val.stufe.nichtEingestuft": "not classified",
  "val.stufe.auskunftFehlt": "Classification not in this response",
  // JOB 3112 · V3: the classification question before approving — it asks, it does not demand.
  "val.stufenfrage.frage": "Which confidentiality level applies to this entry?",
  "val.stufenfrage.ohneStufe": "Approve without a level",
  "val.stufenfrage.abbrechen": "Cancel",
  "val.stufenfrage.fehler": "Not saved — nothing was approved. Please try again.",
  // Round 2: the third outcome of the two-step path — the level is saved, the approval is not.
  "val.stufenfrage.nurNochFreigeben": "The level is saved — only the approval is missing.",
  "val.stufenfrage.fehlerNachStufe":
    "The level “{{stufe}}” is saved. The approval itself failed — the entry is NOT approved.",
  "val.stufenfrage.wiederholen": "Retry approval",
  // JOB 3112 · V3: the pair hint on the review card. It says THAT, never WHAT.
  "val.doppel.satz": "A second copy of this entry exists in the stock: {{beziehung}}.",
  "val.doppel.satzMehrere":
    "{{n}} overlapping copies of this entry exist in the stock — strongest overlap: {{beziehung}}.",
  "val.doppel.vergleich": "Open comparison",
  // R-0247: explicit confirmation before validating while an open duplicate exists.
  "val.doppel.bestaetigung.frage":
    "There is an open duplicate for this entry. Please confirm that you have seen it before validating.",
  "val.doppel.bestaetigung.ja": "Duplicate seen — validate anyway",
  "val.doppel.bestaetigung.abbrechen": "Cancel",
  "val.herkunft.label": "Capture path",
  "val.herkunft.unbekannt": "Origin unknown",
  "val.herkunft.auskunftFehlt": "Origin not in this response",
  // JOB 3027 R2: the list stays when a refresh fails — and says so.
  "val.refreshFailed":
    "The refresh failed. You are seeing the last loaded state — it may be out of date.",
  "demo.ask.label": "1 · Ask",
  "demo.ask.desc":
    "Ask a backed question (valve X / overpressure) — the answer comes source-bound with trust and status, not made up.",
  "demo.library.label": "2 · See knowledge",
  "demo.library.desc":
    "In the library see source, trust, status and maturity — opening an object shows evidence and version.",
  "demo.validation.label": "3 · Validate",
  "demo.validation.desc":
    "Open/unverified knowledge belongs in validation — rate it until it is secured and usable.",
  // SCRUM-296: active capture flow in demo context (Capture → Validation → Use).
  "demo.captureEntry": "Try it actively: Capture → Review → Use",
  "demo.banner.capture.title": "Capture an experience note",
  "demo.banner.capture.body":
    "What gets saved is an OPEN knowledge object — not yet validated. Next step: send it for review/validation. Only after sufficient review is it usable source-bound; nothing is validated automatically.",
  "demo.banner.capture.next": "Next: send for review",
  // SCRUM-291: recognisable path hint boxes on the target pages (only with ?demo=stage1).
  "demo.banner.tag": "Demo path",
  "demo.banner.ask.title": "Step 1: Ask source-bound",
  "demo.banner.ask.body":
    "The answer comes with trust and source — not made up. Watch status/trust, then look at the source/object.",
  "demo.banner.ask.next": "Next: see knowledge",
  "demo.banner.library.title": "Step 2: See source, trust, status, maturity",
  "demo.banner.library.body":
    "Here each object shows source, trust, status and maturity/version. If a source is open/unverified, continue to validation.",
  "demo.banner.library.next": "Next: validate",
  "demo.banner.detail.title": "Knowledge object: check status, trust, version, sources",
  "demo.banner.detail.body":
    "Here you see what usability is based on: status, trust, version and evidence. If it is usable, use “Use knowledge” below — the question stays source-bound, nothing is secured automatically.",
  "demo.banner.validation.title": "Step 3: Rate open knowledge",
  "demo.banner.validation.body":
    "Here open/unverified knowledge is rated. Goal: turn review work into secured, usable knowledge.",
  "cycle.capture.label": "Capture",
  "cycle.capture.desc": "Save experience knowledge as a knowledge object.",
  "cycle.validate.label": "Validate",
  "cycle.validate.desc": "Review as a team until trust and status hold.",
  "cycle.use.label": "Use",
  "cycle.use.desc": "Use it source-bound in answers and output.",
  "cycle.maintain.label": "Maintain",
  "cycle.maintain.desc": "Re-validate on change — knowledge stays valid.",
  "kg.start.title": "How to read Klarwerk",
  "kg.start.body":
    "Klarwerk keeps usable knowledge separate from review work: review first, use afterwards.",
  "kg.library.title": "Result maturity",
  "kg.library.body":
    "The maturity badge shows whether a result is ready to use or belongs in review.",
  "kg.ask.title": "Answers are source-bound",
  "kg.ask.body":
    "Ask uses the knowledge base; open or unverified sources are marked and routed to validation.",
  "kg.secured.label": "Verified",
  "kg.secured.body":
    "Validated knowledge is usable and remains traceable through sources, trust and version.",
  "kg.review.label": "To review",
  "kg.review.body": "Open or in-review knowledge belongs in validation, not direct use.",
  "kg.sourceBound.label": "Source-bound",
  "kg.sourceBound.body": "Answers come from knowledge objects — without a basis, a gap is created.",
  // JOB 3015 D5 — see the DE block.
  "start.konsole.frage": "What do you want to know?",
  "start.konsole.feld": "Question or search term",
  "start.konsole.leitsatz": "No AI answer without evidence · Confidential stays confidential",
  // JOB 3064 H5 — see the DE block.
  "start.fuerdich.kicker": "FOR YOU",
  "start.fuerdich.art.conflict": "Conflict",
  "start.fuerdich.art.duplicate": "Duplicate",
  "start.fuerdich.art.gap": "Knowledge gap",
  "start.fuerdich.art.assignment": "Assignment",
  "start.fuerdich.art.impact": "Impact",
  "start.zuletzt.kicker": "RECENT",
  "start.zuletzt.heute": "today",
  "start.zuletzt.gestern": "yesterday",
  "start.zuletzt.leer": "Nothing captured yet.",
  "start.leer.ersterSchritt": "No knowledge in the collection yet — capture the first one",
  "start.leer.auffrischung": "refreshing …",
  "start.menu.label": "More about this page",
  "start.menu.ueber": "About KLARWERK",
  "start.menu.klara": "Klara in Word",
  "start.menu.kreis": "Knowledge cycle",
  "start.menu.demo": "Demo path",
  "start.menu.erst": "First-time setup",
  "start.menu.gerade": "Right now",
  "start.menu.kapital": "Knowledge capital",
  "start.menu.kollision": "My own objects",
  "start.menu.stufe2": "Stage 2",
  "start.menu.hilfe": "Help for this page",
  // AUFTRAG-mega38 BLOCK G1 — see the DE block.
  "start.purpose":
    "Klarwerk collects what your colleagues have learned on the job, so that you can ask about it and see where every answer comes from.",
  "start.ctaAsk": "Ask a question",
  "start.ctaCapture": "Capture knowledge",
  "start.ctaValidate": "Open validation",
  "klara.path.ariaLabel": "Klara — upcoming assisted path",
  "klara.path.kicker": "With Klara",
  "klara.path.soon": "Coming soon",
  "klara.path.start.title": "Klara supports knowledge from the very beginning.",
  "klara.path.start.body":
    "Soon you can capture, structure and prepare knowledge for review directly with Klara.",
  "klara.path.start.cta": "Capture knowledge with Klara",
  "klara.path.capture.title": "Tell Klara — she turns it into a clear draft.",
  "klara.path.capture.body":
    "Share your experience in your own words. Klara helps structure it; you review and decide.",
  "klara.path.capture.cta": "Start with Klara",
  "klara.path.import.title": "Klara helps you prepare imported knowledge.",
  "klara.path.import.body":
    "After upload, Klara will help organise, clarify and prepare it for review.",
  "klara.path.import.cta": "Import with Klara",
  "klara.path.helpLink": "Klara already helps you in the web app — open the help page here.",
  "klara.path.m365.summary": "What Klara will do in Microsoft 365",
  "klara.path.m365.body":
    "Klara is planned as a bidirectional add-in for Microsoft 365. She will pick up knowledge where you already work, prepare it in a structured way for Klarwerk and make reviewed company knowledge from Klarwerk available directly in Microsoft 365 — reviewing and deciding stays with you. This is not available yet.",
  "shelp.cycle.title": "The Knowledge-OS cycle",
  "shelp.cycle.body":
    "The four tiles are the life cycle of your knowledge: Capture → Validate → Use → Keep current. Each tile takes you straight to the matching area. You don't have to do everything at once — start with whatever is due now. Nothing kicks off on its own.",
  "shelp.work.title": "Your work overview",
  "shelp.work.body":
    "This is what actually awaits you right now — from real data (open reviews, conflicts, knowledge gaps), not an invented to-do list. The number on the right tells you how many. Click a row to continue right there. If you do nothing, nothing happens automatically.",
  "shelp.severity.title": "The coloured dots",
  "shelp.severity.body":
    "The dot on the left shows urgency: Red = do now (blocking or critical), Yellow = worth doing today, Grey = can wait. It is guidance only, not a rule — you decide the order, and nothing is processed automatically.",
  "work.conflicts": "Resolve conflicts",
  "work.criticalGaps": "Critical knowledge gaps",
  "work.revalidation": "Revalidations due",
  "work.validation": "Open validations",
  "work.learning": "Open learning-path steps",
  "roleLink.noReach": "No access",
  "roleLink.noReachHint":
    "This area is not enabled for your role. The figure stays because it is true — only the way there is closed to you.",
  "start.stufe2.title": "Advanced features (Stage 2)",
  "start.stufe2.body":
    "Stage 2 are additional modules beyond the core flow. As an admin you have advanced features available: {{features}}. Turn on '{{toggle}}' in the sidebar to show them.",
  "task.kicker": "Tasks",
  "task.critical": "Critical",
  "task.today": "Today",
  "task.later": "Later",
  "task.none": "Nothing open.",
  "task.weiter": "What happens next?",
  "task.erklaerung": "What needs to be done?",
  "task.noneFiltered": "No item for this filter.",
  "task.filter.all": "All",
  "task.filter.validation": "Validation",
  "task.filter.returned": "Rework",
  "task.filter.conflict": "Conflicts",
  "task.filter.gap": "Knowledge gaps",
  "task.filter.revalidation": "Revalidation",
  "task.conflict": "Conflict",
  "task.validation": "Validation",
  "task.revalidation": "Re-validation",
  "task.gap": "Knowledge gap",
  "task.gapRedacted": "Confidential knowledge gap",
  "task.returned": "Rework",
  "task.action.returned": "Revise draft",
  "task.action.conflict": "Decide conflict",
  "task.action.validation": "Review knowledge",
  "task.action.revalidation": "Check validity",
  "task.action.gap": "Prioritize gap",
  "task.action.open": "Open",
  "task.explain.returned":
    "A reviewer sent your knowledge back for rework. Open it, address the feedback and resubmit it.",
  "task.explain.conflict":
    "Two statements contradict each other. Open the conflict and decide which one holds (or keep both on record).",
  "task.explain.validation":
    "Review this knowledge and cast a rating: approve (green), query (amber) or reject (red). Once enough green ratings are in, it counts as validated.",
  "task.explain.revalidation":
    "Something changed — confirm whether this knowledge is still valid, or send it back for revision.",
  "task.explain.gap":
    "This question lacks confirmed knowledge. Prioritize the gap or capture a contribution for it yourself.",
  "task.explain.open": "Open this task to see the next step.",
  // SCRUM-297: Knowledge-OS phase per work item (reuses cycle.*.label).
  "task.phaseLabel": "Phase:",
  "capture.kicker": "Capture knowledge",
  "capture.title": "Capture experience knowledge",
  "capture.rescue.kicker": "Rescue knowledge",
  "capture.rescue.title": "Secure experience knowledge before it's lost.",
  "capture.rescue.subtitle":
    "You don't have to fill in a form perfectly — just tell us what you know. Klarwerk and the AI help you make it clear and usable.",
  "capture.rescue.step.tell.label": "1. Tell it",
  "capture.rescue.step.tell.hint":
    "Write or dictate what you know from experience, in your own words — rough is fine.",
  "capture.rescue.step.structure.label": "2. AI structures it",
  "capture.rescue.step.structure.hint":
    "The AI turns it into a clear draft; in the Knowledge Studio you can refine everything calmly.",
  "capture.rescue.step.validate.label": "3. Get it reviewed",
  "capture.rescue.step.validate.hint":
    "Saving is enough — then colleagues review the knowledge before it's used as verified.",
  "capture.rescue.impactTitle": "Why your contribution matters",
  "capture.rescue.impact.secure": "Rescues experience that would otherwise be lost",
  "capture.rescue.impact.improve": "Improves the shared knowledge base",
  "capture.rescue.impact.honest": "Marked as verified only after review",
  "capture.rescue.showLess": "Less",
  "capture.rescue.showMore": "Guide",
  // SCRUM-370: guided path — raw knowledge → structure in the Studio (recommended) → review & submit.
  "capture.flow.railKicker": "How to proceed",
  "capture.flow.step.raw.label": "Capture raw knowledge",
  "capture.flow.step.raw.hint": "Tell us what you know in your own words — bullet points are fine.",
  "capture.flow.step.studio.label": "Structure in the Studio",
  "capture.flow.step.studio.hint":
    "The large workspace with AI help turns it into a clear article — you apply changes deliberately.",
  "capture.flow.step.review.label": "Review & submit",
  "capture.flow.step.review.hint":
    "Save and send for review — it only counts as verified afterwards.",
  "capture.flow.railKickerHint":
    "The Knowledge Studio is the recommended path — nothing is forced.",
  "capture.flow.studioRecommended": "Recommended",
  "capture.flow.studioLead":
    "Recommended next step: structure calmly in the Knowledge Studio. The form stays available to you.",
  "capture.flow.submitValue":
    "Your experience knowledge is secured before it's lost — it only counts as verified after review. Nothing is validated automatically.",
  "capture.wizard.back": "Back to telling",
  "capture.wizard.structuring": "The AI is structuring your knowledge …",
  "capture.wizard.condMeasures": "Conditions & measures",
  "capture.wizard.condMeasuresHint":
    "Derived from your knowledge — important for review and later use. Adjust here if needed.",
  "capture.wizard.helpers": "Help, templates & attachment context",
  "capture.wizard.helpersHint": "Optional support — none of this is mandatory.",
  "capture.wizard.docLabel": "Your knowledge page",
  "capture.wizard.pageTitle": "Edit knowledge page",
  "start.orientation.title": "Orientation: how to read Klarwerk & the demo path",
  "start.orientation.hint":
    "Open on your first visit — collapsed here afterwards, expandable anytime.",
  "capture.wizard.titleLabel": "Title",
  "capture.wizard.structData": "Core statement, conditions & measures",
  "capture.wizard.discard": "Discard",
  // JOB 1154 D2 — see the German block: three locked states, three distinct sentences.
  "capture.wizard.step.lockedCurrent": "You are already in this step.",
  "capture.wizard.step.lockedNeedDraft":
    "No draft yet: tell your knowledge first and have it structured.",
  "capture.wizard.step.lockedViaSubmit": "This step opens via “Review & submit”.",
  "ko.couple.title": "Asset coupling",
  "ko.deleteButton": "Delete knowledge object",
  "ko.deleteQ":
    "Delete? The entry moves to the recycle bin where an admin can restore it for 30 days. Demo data is deleted permanently right away.",
  "ko.deleteKeep": "Keep",
  "ko.deleteYes": "Yes, delete",
  "ko.deleteDone": "Knowledge object deleted.",
  "ko.deleteAlreadyGone": "Knowledge object was already gone. List refreshed.",
  "adm.ai.title": "AI management",
  "adm.purgeButton": "Remove demo data",
  "adm.purgeQ":
    "Really delete ALL demo data (including tester-modified)? Your own knowledge stays untouched.",
  "adm.purgeKeep": "Cancel",
  "adm.purgeYes": "Yes, remove permanently",
  "adm.purgeDone":
    "Demo data removed: {{kos}} knowledge objects, {{conflicts}} conflicts + {{duplicates}} duplicates resolved, {{gaps}} knowledge gaps, {{users}} demo users.",
  "adm.seedSkippedInline":
    "Not loaded: the demo set is already present (no duplicates). Use “Remove demo data” to remove it and then load it again.",
  "adm.seedForce": "Reload demo set",
  // AUFTRAG-mega64 Block A — see the German original for the reasoning.
  "adm.seedCredsTitle": "One-time passwords for the new demo accounts",
  "adm.seedCredsHint":
    "These passwords were just generated at random and are shown HERE ONLY. The server does not keep them and cannot repeat them. Write them down or pass them on now — reloading this page loses them, and the accounts will then need a password reset.",
  "adm.factory.title": "Factory settings",
  "adm.factory.help":
    "Fully resets the local instance: all knowledge objects, users, conflicts, gaps and settings are deleted. The program then quits; on the next start the initial setup runs and the first user becomes admin again. Only available in the local desktop version.",
  "adm.factory.hint":
    "For repeated testing: wipe everything and quit the program. After a restart it's all fresh, just like first setup.",
  "adm.factory.button": "Reset to factory settings",
  "adm.factory.confirm1": "Really delete ALL data and quit the program?",
  "adm.factory.passwordLabel": "Confirm with your admin password",
  "adm.factory.confirm2": "Final warning: this step cannot be undone.",
  "adm.factory.warnBody":
    "ALL knowledge objects, accounts and settings will be deleted and the program will quit. This cannot be undone.",
  "adm.factory.wrongPassword": "Wrong password — the factory reset was not performed.",
  "adm.factory.cancel": "Cancel",
  "adm.factory.continue": "Continue",
  "adm.factory.execute": "Reset & quit",
  "adm.factory.restartHint":
    "Reset done. The program is quitting — please restart the KLARWERK app. The first user will become admin again.",
  "adm.factoryDone": "Factory reset triggered — the program is quitting.",
  "capture.tellResetQ": "Really discard text and attachments?",
  "capture.diktatListening": "Recording — just speak; the text appears in the field below.",
  "capture.diktatIdleHint": "Hit the button and start talking — no form, no preparation.",
  "adm.ai.help":
    "Choose globally or per use which AI does the work. “Auto” uses the model when a key is configured; “Deterministic” deliberately works without a model. Keys stay on the server only — never in the browser.",
  "adm.ai.internExtern":
    "You can run internal (On-Premise Enterprise AI, your own LLM) or external (cloud) — globally as the default or fine-grained per task. The internal option appears as soon as an own LLM is reachable; test both live via “Test key” / “Test local LLM”.",
  "adm.ai.status": "Active provider: {{provider}} · mode: {{mode}}",
  "adm.ai.modeModel": "Model",
  "adm.ai.modeDemo": "Deterministic",
  "adm.sec.konten": "Users and roles",
  "adm.sec.ki": "AI",
  "adm.sec.quellen": "Sources and data",
  "adm.sec.vorfuehrdaten": "Demo and sample data",
  "adm.sec.sicherheit": "Security and evidence",
  "adm.sec.berichte": "Reports and analysis",
  "adm.sec.system": "System",
  "adm.ziel.demo": "Demo data",
  "adm.ziel.demo.syn": "Demo, sample data, seed, Vorführdaten",
  "adm.ziel.protokoll": "Audit trail",
  "adm.ziel.papierkorb.syn": "Trash, deleted items, bin, Papierkorb",
  "adm.ziel.ki.syn": "AI providers and models, model, provider, KI",
  "adm.sec.bereitschaft": "Readiness",
  "adm.print": "Print",
  "adm.factory.unavailable":
    "Not available in this installation — the factory reset only exists in desktop mode.",
  "adm.removeQ": "Delete account?",
  "adm.removeKeep": "Keep",
  "adm.removeYes": "Yes, delete",
  "einst.titel": "Settings",
  "einst.zurueck": "Back",
  "einst.zeile.nurLesbar": "Read only",
  "einst.detail.unbekannt": "This card does not exist.",
  "einst.detail.offline": "Offline — the current state cannot be fetched right now.",
  "einst.an": "on",
  "einst.aus": "off",
  "einst.pfad": "Path",
  "einst.modul.aus": "Module off",
  "einst.modul.weg": "Enable under System · Advanced modules",
  "einst.wert.unbekannt": "–",
  "einst.wert.nichtAbrufbar": "not available",
  "einst.wert.keine": "none",
  "einst.wert.stand": "as of {{zeit}}",
  "einst.wert.nichtAktualisiert": "not refreshed",
  "einst.konten.nutzer": "Users",
  "einst.konten.leer": "no users yet",
  "einst.konten.wartet": "awaiting approval",
  "einst.konten.befristet": "limited until {{datum}}",
  "einst.konten.abgelaufen": "expired on {{datum}}",
  "einst.konten.fristUnlesbar": "expiry value unreadable",
  "einst.konten.hinzufuegen": "Add user",
  "einst.konten.ansichtAus": "off",
  "einst.konten.nutzerWeg": "This account no longer exists.",
  "einst.rollen.kicker": "ROLES",
  "einst.rollen.kiWahl": "free choice of AI",
  "einst.rollen.wort.fragen": "ask",
  "einst.rollen.wort.lesen": "read",
  "einst.rollen.wort.erfassen": "capture",
  "einst.rollen.wort.pruefen": "review",
  "einst.rollen.wort.konflikte": "conflicts",
  "einst.rollen.wort.duplikate": "duplicates",
  "einst.ki.grenzen": "Checks and limits",
  "einst.ki.aktivZahl": "{{count}} active",
  "einst.ki.grenzeWert": "{{mb}} MB per attachment",
  "einst.ki.dupWert": "from {{prozent}} %",
  "einst.daten.demoDa": "{{count}} objects",
  "einst.daten.demoBestand": "Demo content",
  "einst.daten.werkVerfuegbar": "available",
  "einst.daten.werkNicht": "not available",
  "einst.sich.punkte": "{{count}} points",
  "einst.sich.bereitWert": "{{ok}} of {{gesamt}} without warning",
  // SCRUM-429 (Pedi 03.07., VIP): first-run guidance for the new admin.
  "adm.firstrun.kicker": "First run",
  "adm.firstrun.title": "Welcome — your workspace is ready to go.",
  "adm.firstrun.lead":
    "As the first account you are admin. Everything needed is prepared — here are three calm first steps. This card only appears on your first visit.",
  "adm.firstrun.dismiss": "Hide",
  "adm.firstrun.done": "Got it — hide",
  "adm.firstrun.note":
    "No pressure, no fixed order: you can start freely anytime. Once hidden, it stays hidden.",
  "adm.firstrun.ki.loading": "Checking AI status …",
  "adm.firstrun.ki.both": "Both AIs connected: cloud AI and your On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud AI connected. Your On-Premise Enterprise AI is not wired up yet (Admin → AI).",
  "adm.firstrun.ki.localOnly":
    "Local LLM connected. The cloud AI is not configured yet (Admin → AI).",
  "adm.firstrun.ki.none":
    "No AI connected yet — the deterministic fallback keeps working (Admin → AI).",
  "adm.firstrun.step.capture.t": "Capture knowledge",
  "adm.firstrun.step.capture.b": "Tell the AI or upload a document — it structures, you review.",
  "adm.firstrun.step.validate.t": "Review knowledge",
  "adm.firstrun.step.validate.b":
    "Experience knowledge is released in review — only then is it “usable”.",
  "adm.firstrun.step.admin.t": "Open administration",
  "adm.firstrun.step.admin.b": "Accounts, AI connection, data and security in one place.",
  "adm.firstrun.doneBadge": "done",
  // SCRUM-437 (Pedi 03.07., VIP): readiness checklist — one-glance status before the test.
  "adm.ready.title": "VIP readiness",
  "adm.ready.help":
    "An honest one-glance status before the test: what's in place, what's missing. Every row from real numbers, nothing sugar-coated.",
  "adm.ready.intro":
    "Quick control glance before the VIP test — green means ready, amber means check.",
  "adm.ready.note":
    "“Open reviews” and the external knowledge stage are neutral facts — not a flaw, just context.",
  "adm.ready.ki": "Connected AIs",
  "adm.ready.ki.both": "Both connected",
  "adm.ready.ki.partial": "Partially connected",
  "adm.ready.ki.none": "None connected",
  "adm.ready.validated": "Validated knowledge",
  "adm.ready.openReviews": "Open reviews",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Upload limits",
  "adm.ready.upload.val": "{{n}} attachments · {{mb}} MB",
  "adm.ready.unknown": "unknown",
  "adm.ready.loading": "loading …",
  // JOB 4363 (H6-D1b) — see the German block for the reasoning.
  "adm.ready.stand.offline": "not refreshed — no network connection",
  "adm.ready.stand.netzluecke": "no new answer has arrived since the interruption",
  "adm.ready.stand.laeuft": "refreshing now",
  "adm.ready.demo": "Demo data",
  "adm.ready.demo.loaded": "{{n}} loaded — removable under Data",
  "adm.ready.demo.none": "none loaded",
  "adm.ready.demo.goto": "Go to Data",
  "adm.ready.external": "External knowledge lookup",
  "adm.ready.ext.blocked": "Blocked",
  "adm.ready.ext.searchOnClick": "Search on click",
  "adm.ready.ext.searchAttach": "Search & attach",
  "adm.ready.ext.open": "Open",
  // JOB 4025 — the backup information card (mirror of the DE keys). `none` is a PROVEN negative
  // statement (read succeeded, directory empty); `unknown` is “cannot be determined” and must never
  // be worded like `none`; `honesty` names what the list does not prove.
  "adm.backup.title": "Backup",
  "adm.backup.help":
    "What is in this installation's backup directory? The card reads it when you open it: per file its timestamp, its size and whether the checksum file written by the backup script sits next to it. It starts no backup, deletes none and downloads none — it only reports what is there.",
  "adm.backup.honesty":
    "This display shows, for each backup file found, its checksum status. No hash comparison and no restore take place here — the restore drill checks both.",
  "adm.backup.none": "No backup found in directory {{verzeichnis}}.",
  "adm.backup.unknown": "Cannot determine whether a backup exists.",
  "adm.backup.reason.missing": "The backup directory does not exist.",
  "adm.backup.reason.unreadable": "The backup directory was not readable ({{grund}}).",
  "adm.backup.certified": "checksum file present",
  "adm.backup.uncertified": "no valid checksum file — restore not proven",
  "adm.backup.dir": "Directory: {{verzeichnis}}",
  "adm.backup.readAt": "Read at {{zeit}}",
  "adm.backup.time.unknown": "Timestamp unknown",
  "adm.backup.size.unknown": "Size not measurable",
  "adm.backup.size.b": "{{n}} bytes",
  "adm.backup.size.kb": "{{n}} KB",
  "adm.backup.size.mb": "{{n}} MB",
  "adm.backup.age.now": "less than an hour ago",
  "adm.backup.age.hours_one": "{{count}} hour ago",
  "adm.backup.age.hours_other": "{{count}} hours ago",
  "adm.backup.age.days_one": "{{count}} day ago",
  "adm.backup.age.days_other": "{{count}} days ago",
  // JOB 4109 — siehe den deutschen Block: die Nummer wird als Nummer genannt, nicht als
  // Ordnungszahl, weil „1st/2nd/3rd/4th" an der Zahl hängt und eine feste Endung falsch wäre.
  "adm.backup.seq": "backup no. {{n}} of the same second",
  "adm.backup.row.none": "none",
  "adm.backup.row.unknown": "cannot be determined",
  // SCRUM-432 (Pedi 03.07., VIP investor): Trust & Security.
  "adm.sich.auditTitle": "Audit trail — hash-chained, deviations verifiable",
  "adm.sich.auditHelp":
    "Every security-relevant action is only appended and linked to the previous entry via a hash chain. If an entry is changed or removed afterwards, its hash no longer matches — the deviation is computationally detectable and the integrity run names it with number, date and action. The chain has no externally anchored head: anyone with full write access to the database can recompute an entry together with every following hash. So the trail is verifiable (tamper-evident) — the chain does not stop a change, it makes it conspicuous.",
  "adm.sich.auditIntro":
    "Append-only, hash-chained: a verifiable trail of all security-relevant actions. A later deviation on an entry can be detected by recomputation.",
  "adm.sich.auditCount": "{{count}} entries in the chain",
  "adm.sich.verify.button": "Verify integrity",
  "adm.sich.verify.ok": "Integrity verified ✓ — {{count}} entries, chain intact",
  "adm.sich.verify.serialisation":
    "Chain complete — {{count}} entries, no break. For {{n}} entries the payload checksum cannot be recomputed because the database normalises the order of the payload fields. The values as they stand match the stored hash; no deviation remains unresolved.",
  "adm.sich.verify.unconfirmed":
    "Chain not confirmed — first deviation at entry {{seq}} of {{at}} ({{action}}). Type: {{kind}}. The cause must be examined.",
  "adm.sich.verify.unconfirmedPlain": "Chain not confirmed — the cause must be examined.",
  "adm.sich.verify.kind.linkage": "chain link broken",
  "adm.sich.verify.kind.serialisation": "database field order",
  "adm.sich.verify.kind.unresolved": "payload checksum not resolvable",
  "adm.sich.verify.kind.unchecked": "payload checksum not examined (too many field orders)",
  "adm.sich.dataTitle": "Data protection & security",
  "adm.sich.dataHelp":
    "An honest extract of the system's properties — not promises, but how KLARWERK is built.",
  "adm.sich.keys.t": "Keys stay in the keychain",
  "adm.sich.keys.b":
    "API keys live exclusively server-side or in the macOS keychain — never in the browser, never in code or the repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI possible",
  "adm.sich.localAi.b":
    "Besides the cloud AI you can wire up your own local LLM. The local AI is reachable only via a private tunnel, never public.",
  "adm.sich.external.t": "External knowledge lookup restricted by default",
  "adm.sich.external.b":
    "Public AI and web search are admin-controlled and not open by default. Nothing leaves the system uncontrolled.",
  "adm.sich.audit.t": "Hash-chained audit trail",
  "adm.sich.audit.b":
    "All security-relevant actions are recorded append-only and hash-chained. A later deviation on an entry is detectable by recomputation and is named by the integrity run (tamper-evident).",
  "adm.sich.trash.t": "Deletion with trash",
  "adm.sich.trash.b":
    "Deleted items go to the trash first (recoverable); final deletion happens only after 30 days. No silent data loss.",
  "adm.sich.roles.t": "Roles & least privilege",
  "adm.sich.roles.b":
    "Four roles (viewer, expert, controller, admin). Every action checks the required permission server-side.",
  "adm.sich.noCustomerData.t": "No customer data in tests",
  "adm.sich.noCustomerData.b": "Quality assurance and evaluations run without real customer data.",
  // SCRUM-444: evidence framing on the printable extract — brand core "trust is evidence".
  "adm.sich.evidenceNote":
    "All figures here are live values from this instance — measured, not claimed. Any target values or example calculations are always explicitly labeled as such.",
  "adm.ai.test": "Test key",
  "adm.ai.testRunning": "testing …",
  "adm.conflictSelfTest.button": "Test conflict detection",
  "adm.conflictSelfTest.running": "testing detection …",
  "adm.conflictSelfTest.ok": "conflict + collision fields + verbatim evidence detected",
  "adm.conflictSelfTest.noModel": "no model (deterministic fallback) — no detection",
  "adm.conflictSelfTest.noConflict":
    "model active, but no conflict detected (model error or verdict: no contradiction)",
  "adm.conflictSelfTest.noKollision": "conflict detected, but collision fields empty",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Collision point: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Conflict",
  "adm.selfTest.button": "Test detection (conflict + duplicate)",
  "adm.selfTest.running": "testing detection …",
  "adm.dupSelfTest.label": "Duplicate",
  "adm.dupSelfTest.ok": "duplicate detected (semantically equal, lexically different)",
  "adm.dupSelfTest.noModel": "no model (deterministic fallback) — no detection",
  "adm.dupSelfTest.noDuplicate":
    "model active, but no duplicate detected (model error or verdict: not a duplicate)",
  "adm.dupSelfTest.relation": "Relation: {{relation}}",
  "adm.ai.testOk": "Connection ok — {{provider}} responded. The key works.",
  "adm.ai.testLocal": "Test local LLM",
  "adm.ai.testLocalOk": "Local LLM responded ({{provider}}).",
  // JOB 3420 (UX-10b): the blanket key tip is gone — see the note in the German block. The frame
  // carries only the raw message; cause and next step come from `adm.ai.befund.*`/`adm.ai.rat.*`.
  "adm.ai.testFail": "Test failed: {{detail}}",
  "adm.ai.wiederholen": "Run test again",
  "adm.ai.befund.aelter": "Earlier result from {{zeit}} · a new test is running.",
  "adm.ai.befund.aelterOhneZeit": "Earlier result · a new test is running.",
  "adm.ai.befund.zitat": "Provider's reason (verbatim): “{{grund}}”",
  "adm.ai.befund.zugang":
    "The provider refused access (HTTP {{status}}) — the stored credentials were not accepted.",
  "adm.ai.befund.kontingent": "The provider refused due to quota or request rate (HTTP 429).",
  "adm.ai.befund.abgelehnt":
    "The provider rejected the request (HTTP 400) — what it objected to is the request itself, not the access.",
  "adm.ai.befund.nichtErreichbar":
    "The provider could not be reached: network error or an outage on their side.",
  "adm.ai.befund.zeitlimit": "The time limit ran out before the provider answered.",
  "adm.ai.befund.unbrauchbar":
    "The provider answered, but without usable content (empty or truncated).",
  "adm.ai.befund.unbestimmt":
    "Reason not classified — this failure could not be matched to any measured cause.",
  "adm.ai.befund.anfrage":
    "The request to KLARWERK did not get through — there is no test result at all.",
  "adm.ai.befund.lokal.zugang": "Your own LLM server refused access (HTTP {{status}}).",
  "adm.ai.befund.lokal.kontingent": "Your own LLM server refused because it is busy (HTTP 429).",
  "adm.ai.befund.lokal.abgelehnt":
    "Your own LLM server rejected the request (HTTP 400) — what it objected to is the request itself.",
  "adm.ai.befund.lokal.nichtErreichbar":
    "Your own LLM server could not be reached: tunnel or server down, or a network error in between.",
  "adm.ai.befund.lokal.zeitlimit": "The time limit ran out before your own LLM server answered.",
  "adm.ai.befund.lokal.unbrauchbar": "Your own LLM server answered, but without usable content.",
  "adm.ai.befund.lokal.unbestimmt":
    "Reason not classified — this failure of your own LLM server could not be matched to any measured cause.",
  "adm.ai.rat.zugang":
    "Next step: renew the stored credentials for this provider and restart the app.",
  "adm.ai.rat.zugangKonto.openai":
    "Next step: renew the key in the start dialog or keychain (service Klarwerk, account OPENAI_API_KEY), then restart the app.",
  "adm.ai.rat.zugangKonto.anthropic":
    "Next step: renew the key in the start dialog or keychain (service Klarwerk, account ANTHROPIC_API_KEY), then restart the app.",
  "adm.ai.rat.kontingent": "Next step: test again later. A different key changes nothing here.",
  "adm.ai.rat.abgelehnt":
    "Next step: check the model and parameter choice. A new key does not help in this situation.",
  "adm.ai.rat.nichtErreichbar":
    "Next step: try once more; if it persists, the fault is at the provider or in the network.",
  "adm.ai.rat.zeitlimit":
    "Next step: start the test again; if it stays this way, check model size and load.",
  "adm.ai.rat.unbrauchbar": "Next step: test again and check the model choice.",
  "adm.ai.rat.anfrage": "Next step: check the connection and start the check again.",
  "adm.ai.rat.lokal.zugang":
    "Next step: check the address and credentials of your own LLM server (KLARWERK_LOCAL_LLM_URL/_MODEL).",
  "adm.ai.rat.lokal.kontingent":
    "Next step: test again later — your own LLM server is busy right now.",
  "adm.ai.rat.lokal.abgelehnt":
    "Next step: check the model name and parameters of your own LLM server.",
  "adm.ai.rat.lokal.nichtErreichbar":
    "Next step: check the tunnel and your own LLM server, then test again.",
  "adm.ai.rat.lokal.zeitlimit":
    "Next step: test again; if your own LLM server is consistently too slow, check the model or the hardware.",
  "adm.ai.rat.lokal.unbrauchbar":
    "Next step: test again and check the model name of your own LLM server.",
  "adm.ai.global": "Global (default for all uses)",
  "adm.ai.choice.inherit": "— same as global —",
  "adm.ai.choice.auto": "Auto (model when available)",
  "adm.ai.choice.anbieter": "External · {{name}}",
  "adm.ai.choice.anbieterUnavailable": "External · {{name}} (not set up)",
  "adm.ai.choice.autoMit": "currently {{name}}",
  "adm.ai.choice.local": "Internal · own LLM (on-prem)",
  "adm.ai.choice.localUnavailable": "Internal · own LLM (not connected)",
  "adm.ai.choice.deterministic": "Deterministic (no model)",
  "adm.ai.envLocked":
    "The AI mapping is fixed by the deployment configuration (KLARWERK_REASONER_POLICY) and cannot be changed here.",
  "adm.ai.migrated":
    "Old value “{{von}}” was carried over to {{nach}} — please check and click “Apply mapping”.",
  "adm.ai.dirtyActive": "Selected: {{gewaehlt}} · until applied, still active: {{aktiv}}.",
  "adm.ai.deviation": "Differs from the default: {{list}}",
  "adm.ai.task.structure": "Structuring",
  "adm.ai.task.assist": "Writing palette (AI help)",
  "adm.ai.task.interview": "Guided interview",
  "adm.ai.task.answer": "Answering questions",
  "adm.ai.task.select": "Candidate selection",
  "adm.ai.task.extract": "Knowledge from file",
  "adm.ai.task.describe": "Image description (suggestion)",
  "adm.ai.task.group": "Group import candidates",
  "adm.ai.effModel": "model",
  "adm.ai.effDet": "deterministic",
  "adm.ai.eff.cloud": "external",
  "adm.ai.eff.openai": "external · ChatGPT (OpenAI)",
  "adm.ai.eff.anthropic": "external · Claude (Anthropic)",
  "adm.ai.eff.local": "internal",
  "adm.ai.eff.deterministic": "deterministic",
  "adm.ai.save": "Apply mapping",
  "adm.ai.detail": "Fine-tune per use",
  "adm.ai.detailHint": "optional — the default is usually enough",
  "adm.ai.saved": "AI mapping applied.",
  "adm.ai.dirtyHint": "Not applied yet — click “Apply mapping”.",
  "adm.ai.applied": "Applied ✓",
  "adm.ai.persistNote":
    "Stored on the server and applies from the next request on — also after reloading, signing in again and restarting.",
  // SCRUM-386: customer-defined AI assist functions (presets) — admin manages, palette shows all.
  "adm.presets.title": "Custom AI functions",
  "adm.presets.help":
    "The AI palette in the editor offers factory functions (Clearer, Structure, Expand, Spelling, Format). Here you add EXTRA functions for your organisation — a button name and the instruction the AI receives (e.g. “Summarise for shift handover in 5 bullet points”). The instruction is openly visible in the palette via the ? mark; as always: the AI only makes a suggestion for preview, adoption is a deliberate click. Factory functions cannot be deleted.",
  "adm.presets.hint":
    "Additional functions for the AI palette in the editor — one button name and one AI instruction each. Visible to all roles; at most 12.",
  "adm.presets.empty": "No custom functions yet — the factory palette applies unchanged.",
  "adm.presets.name": "Button name (e.g. Shift handover)",
  "adm.presets.instruction": "Instruction for the AI (e.g. Summarise in 5 bullet points …)",
  "adm.presets.add": "Add function",
  "adm.presets.save": "Save functions",
  "adm.presets.saved": "Custom AI functions saved.",
  "adm.val.title": "Reviews",
  "adm.val.help":
    "The default reviewer count applies to new submissions without an explicit value. The allowed range is 1 to 5. Existing entries stay unchanged; changes are recorded in the audit log.",
  "adm.val.hint":
    "This is how many review confirmations a new entry needs by default before it counts as validated.",
  "adm.val.label": "Default reviewer count (1–5)",
  "adm.val.save": "Save",
  "adm.val.invalid": "Please enter a whole number between 1 and 5.",
  "adm.val.saved": "Default reviewer count saved.",
  "adm.upload.title": "Upload limits",
  "adm.upload.help":
    "Sets how many attachments an object may have and how large a single attachment may be. Applies to new attachments; existing ones stay. Changes are recorded in the audit log.",
  "adm.upload.hint":
    "These limits appear wherever a file can be selected and are enforced on the server when attaching. The size measures the transferred file including transport encoding (about 1.34× the plain file size).",
  "adm.upload.maxAttachments": "Attachments per object (max.)",
  "adm.upload.maxMb": "Size per attachment (MB, max.)",
  "adm.upload.rawHint": "corresponds to roughly {{raw}} MB of plain file size",
  "adm.upload.save": "Save",
  "adm.upload.saved": "Upload limits saved.",
  "adm.ext.title": "External knowledge",
  "adm.ext.help":
    "Controls whether the app may use external sources (web) and the public AI for enrichment. Four stages from fully blocked to open. Deliberately restrictive by default. Changes are recorded in the audit log.",
  "adm.ext.hint":
    "Applies to external source search during capture/review and to public-AI enrichment.",
  "adm.ext.save": "Save",
  "adm.ext.saved": "External knowledge setting saved.",
  "adm.ext.note": "Takes effect immediately for everyone; the server also enforces the block.",
  "adm.dup.title": "Duplicate detection",
  "adm.dup.help":
    "The AI probability at which a probable duplicate is shown. Lower means more hits, but also more false alarms to dismiss.",
  "adm.dup.hint":
    "The AI compares every new contribution against the whole library by content. This value sets the probability at which a match appears on the Duplicates page.",
  "adm.dup.threshold": "Threshold (%)",
  "adm.dup.save": "Save",
  "adm.dup.saved": "Duplicate threshold saved.",
  "adm.ext.stage.blocked": "Blocked",
  "adm.ext.stage.search_on_click": "Search on click only",
  "adm.ext.stage.search_attach": "Search + attach",
  "adm.ext.stage.open": "Open",
  "adm.ext.stageHint.blocked": "External knowledge fully blocked — nothing visible or callable.",
  "adm.ext.stageHint.search_on_click": "External search only on explicit click (default).",
  "adm.ext.stageHint.search_attach": "External search and attaching results as a source allowed.",
  "adm.ext.stageHint.open": "Open: search, attach and public-AI enrichment allowed.",
  "enrich.title": "Public AI enrichment",
  "enrich.help":
    "Pull additional background from the public AI — either from model knowledge or from a sourced web search. Results are external and unverified; they are only added to your draft on your click and never validated automatically.",
  "enrich.disclaimer": "External & unverified — please review before adding.",
  "enrich.modeModel": "Model knowledge",
  "enrich.modeWeb": "Web search",
  "enrich.placeholder": "What to look for? (e.g. term, question)",
  "enrich.run": "Enrich",
  "enrich.running": "Searching …",
  "enrich.externBadge": "External · unverified",
  "enrich.take": "Add to draft",
  "enrich.noModel": "No AI model connected — public AI enrichment needs an active model.",
  "enrich.empty": "No external results found.",
  // SCRUM-433 (Pedi 03.07., VIP): stay discoverable even when (still) disabled.
  "enrich.disabledHint":
    "Public AI enrichment becomes available once an admin sets external knowledge lookup to “Open” (Admin → External knowledge lookup).",
  "enrich.openAdmin": "Go to admin settings",
  "adm.trash.title": "Recycle bin",
  "adm.trash.help":
    "Deleted entries land here and can be restored for 30 days. After that they are permanently deleted automatically. Demo data never appears here — it is always deleted permanently right away.",
  "adm.trash.empty": "The recycle bin is empty.",
  "adm.trash.restore": "Restore",
  "adm.trash.purge": "Delete permanently",
  "adm.trash.purgeQ": "Permanently delete this entry now?",
  "adm.trash.keep": "Keep",
  "adm.trash.restored": "Entry restored.",
  "adm.trash.purged": "Entry permanently deleted.",
  "adm.trash.deletedMeta": "Deleted by {{name}} on {{date}}",
  "adm.trash.expires": "Permanent deletion in {{days}} days",
  "adm.presets.remove": "Remove function",
  "adm.presets.note":
    "Stored on the server and survives restarts; keys and models are not affected.",
  // SCRUM-413: "Available AIs" — honest overview of all accesses (metadata, no secrets).
  "adm.ai.accessTitle": "Available AIs",
  "adm.ai.accessHelp":
    "Shows all AI accesses of this instance with their honest status: the two external providers ChatGPT (OpenAI) and Claude (Anthropic) individually (keys stay server-side; “Active” is the one selected in AI management, “Ready” one that is set up but not selected), the deterministic fallback that steps in without a model, and the planned local LLM server from team 2. Which access actually applies per task is shown above in the AI management section.",
  "adm.ai.access.openai": "ChatGPT (OpenAI)",
  "adm.ai.access.anthropic": "Claude (Anthropic)",
  "adm.ai.access.fallback": "Deterministic fallback",
  "adm.ai.access.local": "Local LLM server (team 2)",
  "adm.ai.accessNote":
    "Connecting the local LLM server to the app is planned (KLLM-61); until then it runs only on the team-2 test bench.",
  "adm.ai.state.active": "Active",
  "adm.ai.state.available": "Ready",
  "adm.ai.state.missing": "Not configured",
  "adm.ai.state.planned": "Planned",
  "ko.couple.help":
    "Couple this knowledge to an asset and “asset changed” (lifecycle) will automatically flag it for review — knowledge stays current.",
  "ko.couple.empty": "Not coupled to any asset yet.",
  "ko.couple.placeholder": "Asset reference, e.g. line L4",
  "ko.couple.cta": "Couple with asset",
  "ko.couple.done": "Asset coupled — lifecycle now watches this knowledge specifically.",
  "capture.wizard.discardQ": "Really discard this draft? Your narrated text is kept.",
  "capture.wizard.discardKeep": "Keep",
  "capture.wizard.discardYes": "Yes, discard",
  "capture.wizard.discardDone": "Draft discarded — your narrated text is still there.",
  "capture.wizard.upload": "Insert text from file or image",
  "capture.wizard.attach": "Attach file or image",
  "capture.wizard.attached": "{{count}} file(s) attached — visible under “Advanced details”.",
  "capture.wizard.uploadCount":
    "{{count}} attachment(s) added — text from documents is already in the field above; details under “Advanced details”.",
  "capture.gapContextTitle": "From an open knowledge gap",
  "capture.gapContextBody":
    "This is an open question, not knowledge yet — it only serves as a starting context. Add your experience/observation; the AI structures it into a draft, you review and submit.",
  "capture.gapDraftQuestion": "Open question",
  "capture.gapDraftExperience": "Add your own experience/observation",
  // SCRUM-369: guided steps in the gap context (work order: question → experience → AI → review).
  "capture.gapStepsTitle": "Your work order:",
  // SCRUM-369: honest follow-up after saving from an Ask gap — no automatic closure.
  "capture.gapSavedNote":
    "After validation, the knowledge base can answer this question better in future. The knowledge gap is not closed automatically — the review decides.",
  "capture.savedTitle": "Knowledge object saved.",
  // SCRUM-286: honest — saved but still open/not validated; usable only after review.
  "capture.savedStatusBadge": "Status: open — not yet validated",
  // AUFTRAG-mega70 BLOCK C: explains the process instead of asking for an action the role may
  // not be able to take (/validierung requires controller).
  "capture.savedBody":
    "Saved as your own knowledge (not a demo example), but not yet validated. It becomes usable knowledge only once it has been sufficiently rated in validation. Nothing is validated automatically.",
  "capture.savedFromDraft":
    "Your continued draft was submitted as open knowledge and removed from your drafts.",
  // WP-SHIP9-S1 (Pedis B3): the REAL check status on the confirmation card.
  // D-AISTATE PAKET 2 (bens V3): without AI only the deterministic duplicate/overlap check runs — there
  // is no deterministic conflict check (only AI finds conflicts). The "(with AI)" variants name conflicts.
  "capture.aiCheck.running":
    "Duplicate/overlap check running … the result will appear here once it completes.",
  "capture.aiCheck.runningAi":
    "Duplicate/conflict check (with AI) running … the result will appear here once it completes.",
  "capture.aiCheck.done": "Duplicate/overlap check completed (without AI) — details in validation.",
  "capture.aiCheck.doneAi": "Duplicate/conflict check (with AI) completed — details in validation.",
  "capture.aiCheck.failed": "Check failed: {{reason}} You can restart it in validation.",
  // SCRUM-373 / AG-02-SESSION: after saving, images/files have a safe object reference.
  "capture.savedFilesNote":
    "{{count}} attachment(s) are now stored as a safe object reference and can be linked as evidence in the knowledge object's editor. Evidence is context — it does not replace validation.",
  // SCRUM-374 / AG-02-SESSION: honest recovery hint when the KO was saved but some attachments could not
  // be uploaded/attached (partial failure ≠ total failure).
  "capture.attachTooLarge":
    "“{{name}}” is too large for an attachment (upload limit exceeded) — the file was not saved; the text import is kept.",
  "capture.originalAttachFailed":
    "Original file “{{name}}” could not be saved as an attachment — the text import is kept.",
  "capture.attachFailedTitle": "Not all attachments could be saved",
  "capture.attachFailedBody":
    "Your knowledge object is saved as open. These file(s) were NOT attached: {{names}}. The saved knowledge is unaffected — evidence does not replace validation.",
  "capture.attachFailedNext":
    "Next step: open the knowledge object and attach the file(s) again there.",
  "capture.sourceMissingTitle": "Imported content without a provenance record",
  "capture.sourceMissingBody":
    "Your knowledge object is saved and contains the text imported from the document. The matching provenance record could NOT be created ({{count}}): {{names}}. That leaves content without evidence — exactly what this product does not accept in silence.",
  // JOB 4367: `capture.sourceMissingNext` lives in `texte/ux08.ts` now.
  // AUFTRAG-mega21 Block C-1 / C-2 — see the German block for the reasoning.
  "capture.followUpsFailedTitle": "Saved — but one follow-up step did not run",
  "capture.followUpsFailedBody":
    "Your knowledge object is fully saved and evidenced. AFTER saving, the following did not complete: {{steps}}. This does not affect the stored knowledge — but something is left open, and nobody else would tell you.",
  "capture.followUp.draftDiscard": "remove the draft",
  "capture.followUp.draftDiscardNext":
    "The draft is still in your draft list. You can delete it there — the submitted knowledge object is unaffected.",
  "capture.followUp.validationAssign": "assign reviewers",
  "capture.followUp.validationAssignNext":
    "Nobody is waiting for this knowledge object. Open Validation and assign the reviewers again.",
  "capture.followUp.notifyAssignment": "notify reviewers",
  "capture.followUp.notifyAssignmentNext":
    "The assignment stands, only the message did not go out. Let the assigned reviewers know.",
  "capture.followUp.aiCheck": "start the duplicate/conflict check",
  "capture.followUp.aiCheckNext":
    "The check is recorded as failed and can be restarted from the Validation page.",
  // AUFTRAG-mega23 Block B (ben's SB-G): the line above presumes a WRITTEN record. Without proof of
  // it, this one applies — it promises no retry the endpoint would refuse.
  "capture.followUp.aiCheckUnrecordedNext":
    "The failure record itself could not be saved either — so NO repeatable check job exists for this knowledge object. Please review it manually in Validation for duplicates and contradictions.",
  "capture.followUp.unknown": "a step this interface does not know yet",
  "capture.followUp.unknownNext":
    "This version of the interface does not know the step by name. It is in the knowledge object's audit trail — please look there.",
  "capture.anchorsMissingTitle": "A secured original is gone — imported text was not loaded",
  "capture.anchorsMissingBody":
    "This draft refers to {{count}} secured original document(s) that no longer exist. The text imported from them and the matching source references were therefore NOT loaded: they would be content without provenance, and this product does not save that silently. Your own work — title, statement, conditions, measures, reviewer selection — is fully there.",
  "capture.anchorsMissingNext":
    "While this notice is showing, “Save as draft” is blocked: saving now would write the thinned-out state over the stored one.",
  "capture.anchorsMissingReselect": "Select the original again",
  "capture.anchorsMissingAck": "Continue without the original",
  "capture.restartOfferTitle": "This operation cannot be repeated",
  "capture.restartOfferBody":
    "The operation key of this submission already belongs to a completed operation with different content. Your current text is untouched and will not be lost. Saving it needs a NEW operation — that is your decision, not the interface's.",
  "capture.restartOfferAction": "Start a new operation",
  "capture.appendUnclearTitle": "Import with an unclear outcome",
  "capture.appendUnclearBody":
    "Your knowledge object is saved. During the import from {{names}} the connection dropped before the server answered: it may or may not have gone through. NOTHING was taken back — blind cleanup is what would have caused the damage here. Please open the knowledge object and check whether the imported content and its provenance are there.",
  "own.empty.title": "No own knowledge here yet",
  "own.empty.hint":
    "You are filtering for your own knowledge (no demo examples). Knowledge you capture appears here after saving and then waits for review.",
  "own.empty.cta": "Capture own knowledge",
  "studio.open": "Edit in the Knowledge Studio",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "A large workspace with AI help. Changes are written to the draft only when you apply them — no auto-save, no auto-validation.",
  "studio.apply": "Apply to the draft",
  "studio.cancel": "Discard",
  "studio.close": "Close",
  // SCRUM-458 Stage 1: "Simple ↔ Structured" as a view switch (Studio = a view, not a second place).
  "studio.viewSimple": "Simple",
  "studio.viewStructured": "Structured",
  "studio.viewSwitch": "View: simple or structured",
  "studio.attachFromDisk": "Attach file/image from computer",
  "studio.d44.gliederung": "Outline",
  "studio.d44.keineUeberschriften": "No headings in this article",
  "studio.state.dirty": "Not applied",
  "studio.state.clean": "No studio changes",
  "studio.confirmDiscard.q": "Discard changes that haven't been applied?",
  "studio.confirmDiscard.keep": "Keep editing",
  "studio.confirmDiscard.discard": "Discard",
  "studio.fremdfassung.hinweis":
    "A newer version has been created outside. Applying writes your version over it.",
  "studio.applied":
    "Detailed content from the studio applied to the draft. Saving or revising still happens via the existing button — nothing is saved or validated automatically.",
  "studio.save.capture.title": "Studio content in the draft — not saved yet",
  "studio.save.capture.hint":
    "The content applied from the studio is in the draft, but not saved or validated yet.",
  "studio.save.capture.next":
    "Next step: save/submit — then review/validation follows. Nothing is validated automatically.",
  "studio.save.revision.title": "Studio content in the revision draft — not saved yet",
  "studio.save.revision.hint":
    "The content applied from the studio is in the revision draft, but not saved yet.",
  "studio.save.revision.next":
    "Saving creates a new version and restarts the review — no automatic approval.",
  "studio.fromDraft.cta": "Structure the draft as an article in the studio",
  "studio.fromDraft.hint":
    "Generates a structured article suggestion from your draft (statement, conditions, measures, tags) — please review and complete it. Existing content is appended, not overwritten; nothing is validated automatically.",
  "studio.section.context": "Structure & context",
  "studio.section.editor": "Edit content",
  "studio.section.assist": "AI help",
  "studio.guide.structure.label": "Structure",
  "studio.guide.structure.hint": "Organize with headings, steps and highlights.",
  "studio.guide.assist.label": "Check AI",
  "studio.guide.assist.hint":
    "Let the AI clarify/structure — review the suggestion, don't apply blindly.",
  "studio.guide.preview.label": "Preview",
  "studio.guide.preview.hint": "See how the contribution will look later.",
  "studio.guide.apply.label": "Apply",
  "studio.guide.apply.hint": "Apply to the draft deliberately — nothing is saved automatically.",
  "studio.guide.thenSave": "then save & get it reviewed",
  "studio.coach.story":
    "You're rescuing hands-on experience. AI helps you structure it — it only becomes secured once colleagues review it.",
  "studio.coach.firstRun":
    "Start here: tell your knowledge in your own words. Structure, AI help and preview come step by step.",
  "studio.coach.nextPrefix": "Next step",
  "studio.coach.reason.start": "Begin with your experience — even a rough start is valuable.",
  "studio.coach.reason.improve": "Let AI help organize and sharpen it, or add headings and steps.",
  "studio.coach.reason.preview": "Check the preview to see how your contribution will look later.",
  "studio.coach.reason.apply":
    "Looks good? Apply the draft deliberately — saving and review come afterwards.",
  "studio.contrib.title": "Your contribution",
  "studio.contrib.level.empty.label": "Empty",
  "studio.contrib.level.empty.hint": "Start writing — even a rough beginning is valuable.",
  "studio.contrib.level.draft.label": "Draft",
  "studio.contrib.level.draft.hint": "Good start. A few steps make it clearer and more useful.",
  "studio.contrib.level.solid.label": "Solid",
  "studio.contrib.level.solid.hint": "Clearly structured — ready to apply and get reviewed.",
  "studio.contrib.strengthsTitle": "Already good",
  "studio.contrib.strength.text": "Real content present",
  "studio.contrib.strength.headings": "Organized with headings",
  "studio.contrib.strength.steps": "Steps as a list",
  "studio.contrib.strength.highlights": "Important points highlighted",
  "studio.contrib.strength.links": "References/links included",
  "studio.contrib.strength.evidence": "Evidence/attachments present",
  "studio.contrib.suggestionsTitle": "Makes it stronger",
  "studio.contrib.suggestion.detail": "Add a bit more detail",
  "studio.contrib.suggestion.headings": "Headings for sections",
  "studio.contrib.suggestion.steps": "Add steps as a list",
  "studio.contrib.suggestion.referenceAttachments": "Mention attachments in the text",
  "studio.contrib.valueNote":
    "Your experience knowledge matters — it's secured only after colleagues review it.",
  "studio.tips.title": "How to work in the studio",
  "studio.tips.select.label": "Select → format",
  "studio.tips.select.hint":
    "Select text, then set bold/italic via the toolbar — or use the usual keys.",
  "studio.tips.structure.label": "Structure with H2/H3",
  "studio.tips.structure.hint":
    "Group sections with heading 2 and 3, steps as lists — that keeps the content readable.",
  "studio.tips.ai.label": "Review the AI suggestion",
  "studio.tips.ai.hint":
    "AI help on the right produces a suggestion — review it, then apply it deliberately. Nothing is saved automatically.",
  "studio.tips.blocks.label": "Templates & blocks on purpose",
  "studio.tips.blocks.hint":
    "Templates give a structure; info/note/warning/success blocks highlight what matters.",
  "studio.view.edit": "Edit",
  "studio.view.preview": "Preview",
  "studio.preview.empty": "No content yet — write in the editor, then check the preview here.",
  "studio.preview.note":
    "The preview shows the current draft, not validated knowledge. “Apply” only writes to the local draft; saving/submitting/revising then happens via the existing buttons.",
  "capture.savedViewKo": "View object",
  // SCRUM-310: find it in the library — origin filter "own/non-demo knowledge" (technically: without
  // the demo tag; no author/user attribution). Finding/overview, not validation.
  "capture.savedViewLibrary": "View in the library (own knowledge)",
  "capture.savedValidate": "Send for review",
  "capture.savedAgain": "Capture another",
  "capture.mode.freitext": "Free text",
  "capture.mode.formular": "Form",
  "capture.mode.diktat": "Dictation",
  "capture.mode.interview": "Guided interview",
  "capture.mode.datei": "From file",
  // PMO-FEA-0006: knowledge from file — upload, AI point list with source excerpts, review queue.
  "capture.file.hint":
    "Upload a document — the AI lists the knowledge it contains, each point with a verbatim source excerpt. You choose what to take over; nothing is saved automatically.",
  // JOB 3196 (UX-19): the guidance for the WHOLE-DOCUMENT path — read in, exactly one draft with the
  // full content, then open and review it yourself. No AI selection, no validation, no submission.
  "capture.file.hintWhole":
    "Upload a document — Klarwerk reads it and creates exactly one draft containing the whole content. You then open the draft and review it yourself; nothing is checked or submitted automatically.",
  "capture.file.upload": "Choose document",
  "capture.file.replace": "Choose another document",
  "capture.file.remove": "Remove document",
  "capture.file.dropHint": "Drag and drop a file here — or choose one below.",
  // AUFTRAG-mega34 D1: the button says what it does.
  "capture.file.pick": "Choose file",
  "capture.file.dropActive": "Drop the file here …",
  "capture.file.dropReject":
    "“{{name}}” is not supported here yet — please drop a text, Word, PDF, PPTX or image file.",
  "capture.file.extracting": "Reading “{{name}}” …",
  "capture.file.loaded": "“{{name}}” read — ready for the knowledge search.",
  "capture.file.empty": "No text found in “{{name}}”.",
  "capture.file.emptyPdf":
    "No text found in “{{name}}” — a scanned PDF without a text layer is not supported yet.",
  "capture.file.emptyPptx":
    "No importable text found in “{{name}}” (image-only presentation). Nothing was saved — you can attach the original manually as a file if needed.",
  "capture.file.pdfTruncated": "Only the first {{count}} pages were imported.",
  "capture.file.pptxTruncated": "Only the first {{count}} slides were imported.",
  "capture.slides.toggle": "Import slides as images.",
  "capture.slides.toggleHint":
    "For PowerPoint files, every slide is additionally appended to the article as an image (slide view section). The conversion runs on the server and may take a moment.",
  "capture.slides.heading": "Slide view",
  "capture.slides.converting": "Converting slides of {{name}} to images on the server …",
  "capture.slides.done": "{{count}} slide(s) attached as images.",
  "capture.slides.truncated": "Only the first {{max}} slides were converted (hard limit).",
  "capture.slides.dropped":
    "{{count}} slide image(s) no longer fit the article budget and were left out.",
  "capture.slides.busy":
    "The server is currently converting another presentation — please import again in a moment. The text import is complete.",
  "capture.slides.unavailable":
    "The slide view is currently not available on this server. The text import is complete.",
  "capture.slides.timeout":
    "The server is still working or unreachable — the slide conversion was cancelled on the client side; the text import remains fully intact.",
  "capture.slides.failed":
    "The slides could not be converted to images. The text import is complete.",
  // JOB 2687 D1: "too long" and "broken" are two messages — each says what to do next.
  "capture.slides.serverTimeout":
    "The conversion took too long and was stopped — please try a smaller deck (fewer slides or smaller images). The text import is complete.",
  "capture.slides.invalid":
    "The presentation could not be read as slide images — the file is damaged or not a readable .pptx. Please try another file. The text import is complete.",
  "capture.file.pptxTooLarge":
    "“{{name}}” is too large or too heavily compressed for a safe import and was NOT read. Please shrink or split the presentation.",
  // JOB 2700 D1: the PDF size limit before the parser and the parser's time limit — both said, not hung.
  "capture.file.pdfTooLarge":
    "“{{name}}” is {{mb}} MB and too large for import (limit {{limitMb}} MB); it was NOT read. Please split the document — the original stays untouched.",
  "capture.file.pdfTimeout":
    "“{{name}}” could not be read within {{s}} seconds — the import was cancelled. Please shrink or split the document.",
  "capture.file.pptxImagesFormat":
    "{{count}} images could not be carried over — format not supported.",
  "capture.file.pptxImagesBudget":
    "{{count}} images could not be carried over — too large to embed.",
  "capture.file.imagesOnlyNoText":
    "Images carried over — without text, AI suggestions are not possible.",
  "capture.file.imagesAllDropped":
    "The images could not be carried into the article (too large or format not supported) — the original travels along as an attachment when saving.",
  // JOB 513/D3B — see the German block: the line above promises an attachment; without a secured
  // original that promise has no backing.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} image(s) could not be carried into the article, and the original could NOT be saved as an attachment — those images are lost.",
  "capture.file.imagesDefect":
    "{{count}} image(s) could not be read — the reference in the file is broken or the image file is missing.",
  "capture.file.imagesOutsidePath":
    "{{count}} image(s) sit outside the imported slide area (background images, for example) and were not carried over.",
  "capture.file.imagesBudgetBodyHtml":
    "Limit “article text”: {{count}} image(s) no longer fit into the article (at most {{limitBytes}} bytes; {{actualBytes}} were needed).",
  "capture.file.imagesBudgetSingleImage":
    "Limit “single image”: {{count}} image(s) are too large on their own (at most {{limitBytes}} bytes per image; the largest was {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Limit “total images”: {{count}} image(s) would have exceeded the combined size of all images (at most {{limitBytes}} bytes; {{actualBytes}} were needed).",
  "capture.file.imageCaptionPlaceholder": "No image description yet",
  "capture.file.captionsBalance":
    "{{assigned}} image caption(s) taken from the document · {{ambiguous}} not clearly assignable (left empty).",
  "capture.file.captionsBalanceAssigned": "{{assigned}} image caption(s) taken from the document.",
  "capture.file.captionsBalanceAmbiguous":
    "{{ambiguous}} image caption(s) found in the document but not clearly assignable (left empty).",
  "capture.file.imagesKept":
    "{{kept}} images imported, {{compressed}} of them compressed for the text view; the unchanged original is in the attachment.",
  "capture.file.imagesKeptDropped":
    "{{kept}} images imported, {{compressed}} of them compressed; {{dropped}} left out due to size. The unchanged original is in the attachment.",
  "capture.file.imagesNoOriginal":
    "{{kept}} images imported, {{compressed}} of them compressed; the original could NOT be saved as an attachment.",
  "capture.file.imagesLost":
    "{{kept}} images imported, {{compressed}} of them compressed; {{dropped}} left out. The original could NOT be saved — {{dropped}} images are lost.",
  "capture.file.tooLargeForImport":
    "Even after image compression the document is too large for text import — please split it up. The original stays untouched.",
  "capture.file.importNote.docx":
    "Structure and images imported (best effort) — exact layout may differ.",
  "capture.file.importNote.pdf":
    "Best-effort text import — layout and images were not carried over.",
  "capture.file.importNote.pptx":
    "Best-effort import from PowerPoint — text, lists and tables per slide carried over, where present; layout, animations, transitions and speaker notes are lost.",
  "capture.file.importNote.text":
    "Best-effort text import — headings, bullet lists and simple tables carried over; formatting (bold, italics, code), links and images remain as plain characters. Headings and bullet lists need a blank line above them, otherwise they stay running text.",
  "capture.file.parseError": "“{{name}}” could not be read.",
  "capture.file.unsupported":
    "“{{name}}” is not supported here — please provide TXT/MD, DOCX, PDF, or PPTX. Images only work via OCR.",
  "capture.file.ocrCta": "Recognize text in image (OCR)",
  "capture.file.ocrBusy": "Text recognition running …",
  "capture.file.queryLabel": "What should the AI look for? (optional)",
  "capture.file.queryPlaceholder":
    "e.g. “thresholds and inspection intervals” — leave empty to find all knowledge",
  "capture.file.queryHelp.title": "Targeted search",
  "capture.file.queryHelp.body":
    "Without input, the AI lists all knowledge points in the document. With a search focus, it restricts itself to that focus. Nothing is invented either way — every point carries a verbatim excerpt from the document.",
  // SCRUM-451: result language — system language or the document's original language.
  "capture.file.langLabel": "Result in",
  "capture.file.langSystem": "System language",
  "capture.file.langSource": "Original language",
  "capture.file.langHelp.title": "Result language",
  "capture.file.langHelp.body":
    "System language: titles and summaries appear in your interface language (German/English) — an English document is effectively translated. Original language: the AI translates nothing, the points stay in the document's language. Verbatim excerpts remain unchanged in both cases.",
  "capture.file.importMode.label": "Import type",
  "capture.file.importMode.points": "Analyze into points",
  "capture.file.importMode.pointsDesc":
    "Klarwerk extracts individual statements from the file. Existing path; nothing is saved automatically.",
  "capture.file.importMode.whole": "Take over whole document",
  "capture.file.importMode.wholeDesc":
    "Klarwerk creates exactly one draft with the whole document. No automatic validation.",
  "capture.file.searchCta": "Analyze file",
  "capture.file.searching": "The AI is reading the document …",
  "capture.file.wholeCta": "Save whole document as draft",
  "capture.file.wholeSaving": "Saving draft …",
  "capture.file.wholeSaved": "“{{name}}” saved as one draft — source: file name, whole document.",
  "capture.file.wholeSourceNote":
    "The draft visibly records the source: {{name}}, whole document. The draft stays open and unreviewed.",
  "capture.file.wholeSavedTitle": "Document saved as draft",
  // JOB 3196 (UX-19): replaces the bare developer string “Frontdoor bereit”. It states what the
  // state IS — and deliberately claims no review or approval status.
  "capture.file.wholeSavedBadge": "Ready to open — the draft is unreviewed and not submitted.",
  "capture.file.wholeSavedSource": "Source: {{name}}, whole document.",
  "capture.file.wholeOpenDraft": "Open draft",
  "capture.file.wholeOpenMissing": "Draft was saved, but could not be opened directly.",
  "capture.file.wholeImportAnother": "Import another document",
  "capture.file.formatTitle": "Information on file formats and formatting",
  "capture.file.formatHint":
    "TXT/MD and other text files are taken over as text. DOCX: structure (headings, lists, tables) and images are imported best effort; exact layout may differ. PDF runs as a best-effort text import; layout and images are lost. PPTX: text, structure and photos per slide are imported best effort; layout, animations, vector graphics/shapes and notes are lost.",
  "capture.file.supportedTitle": "Actively selectable:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX, and images for OCR.",
  "capture.file.unsupportedFormats":
    "RTF is not supported yet. Please provide TXT/MD, DOCX, PDF, or PPTX where available.",
  "capture.file.cancel": "Cancel",
  "capture.file.pointsTitle": "Knowledge found — choose what to take over",
  "capture.file.pointsHint":
    "Every point carries its source excerpt from the document. Deselect what you don't need — nothing is taken over until you click.",
  "capture.file.excerptLabel": "Source excerpt",
  "capture.file.pointCount": "{{selected}} of {{total}} points selected",
  "capture.file.applyCta": "Take over selected",
  "capture.file.queueBadge": "Point {{current}} of {{total}} from “{{name}}”",
  "capture.file.queueHint":
    "Each point is reviewed and submitted individually as a knowledge page — nothing is saved automatically.",
  "capture.file.queueSkip": "Skip point",
  "capture.file.queueDone": "All points from “{{name}}” have been processed.",
  "capture.file.sourceNote": "The source “{{name}}” will be recorded on the knowledge object.",
  // SCRUM-409 (PMO-FEA-0008 delta): import receipt, multi-point drafts, merge.
  "capture.file.loadedStats":
    "“{{name}}” imported ({{chars}} characters). Optionally say what to look for, then start the knowledge search.",
  // JOB 3196 (UX-19): same receipt for the whole-document path — same honest size, but the next step
  // is the one that actually exists here.
  "capture.file.loadedStatsWhole":
    "“{{name}}” imported ({{chars}} characters). Now create the draft containing the whole document.",
  "capture.file.saveDraftsCta": "Save as drafts",
  "capture.file.draftsSaved":
    "{{count}} drafts saved from “{{name}}” — each with its source note. You can find them above under “Resume drafts”.",
  "capture.file.draftsPartial":
    "Not all points could be saved as drafts: {{failed}}. Drafts already created are kept.",
  "capture.file.mergeCta": "Connect selected into one entry",
  "capture.file.mergedNote":
    "{{count}} points from “{{name}}” merged into one entry — all excerpts are in the document; the sources will be recorded on submit.",
  // SCRUM-433 (Pedi 03.07., VIP): the three paths from the points list, always explained.
  "capture.file.connectHint":
    "Tick several and “Connect” combines them into ONE entry · “Save as drafts” creates one per point · “Take over” processes them one by one.",
  "capture.file.connectDisabledHint": "Tick at least 2 findings to connect them.",
  "capture.file.selectAll": "Select all",
  "capture.file.deselectAll": "Deselect all",
  "capture.file.mergedInList": "Merged {{count}} findings into one point — it stays in the list.",
  "capture.file.applyDisabledHint": "Tick exactly one finding — only one is processed at a time.",
  "capture.file.purgeUnselectedQ": "Delete the {{count}} unselected findings?",
  "capture.file.purgeUnselectedYes": "Delete unselected",
  "capture.file.purgeUnselectedKeep": "Keep",
  // SCRUM-384 / KG-UX-001/002/003/010: narrate-first entry as default, form as expert path.
  "capture.entry.narrateKicker": "Tell your knowledge — the AI structures it, you review",
  "capture.entry.recommendedBadge": "Recommended",
  "capture.entry.expertToggle": "Expert mode: fill the form directly",
  "capture.entry.expertHint":
    "For experienced users: fill in all fields directly — same fields, same review path. The guided narrate-first entry stays available at any time.",
  "capture.entry.expertActive":
    "Expert mode: you fill the form directly. Saving and review work exactly like the guided path — nothing is validated automatically.",
  "capture.entry.backToGuided": "Back to the guided path",
  "capture.raw": "Experience note",
  "capture.rawPlaceholder":
    "Capture experience informally — the AI structures it into a draft. You review and submit.",
  "capture.structure": "Structure with AI",
  "capture.assist": "AI help",
  // SCRUM-375 / AG-12: advanced/technical fields as progressive disclosure (optional, nothing removed).
  "capture.advanced.title": "Advanced details (optional)",
  "capture.advanced.hint":
    "Category, asset, required reviews, tags, documents & images — none of these is required. Tell your knowledge first; you can expand and add the details anytime.",
  "capture.advanced.filled": "{{count}} filled",
  // SCRUM-312: AI post-editing (beta) — a suggestion, no auto-submit; the human applies it deliberately.
  "capture.ai.title": "AI post-editing (beta)",
  "capture.ai.hint":
    "The AI makes a suggestion — you review it and apply it deliberately. No automatic saving, no validation; no content/facts are invented.",
  "capture.ai.bodyHint":
    "AI help for the detailed content: review the suggestion and apply it deliberately (replace/append). No automatic saving, no validation; please check content and sources yourself.",
  "capture.ai.applyAsLabel": "Apply as structure",
  "capture.ai.applyAs.section": "Append as section",
  "capture.ai.applyAs.info": "Append as info",
  "capture.ai.applyAs.note": "Append as note",
  "capture.ai.applyAs.warning": "Append as warning",
  "capture.ai.applyAs.success": "Append as success",
  "capture.ai.action.clarify": "Clearer",
  "capture.ai.action.structure": "Structure",
  "capture.ai.action.expand": "Expand",
  "capture.ai.action.spelling": "Spelling",
  "capture.ai.action.format": "Format",
  "capture.ai.instr.clarify": "Rephrase more clearly and precisely without changing the meaning.",
  "capture.ai.instr.structure":
    "Structure the text into clear, concise sentences or bullet points.",
  "capture.ai.instr.expand":
    "Phrase a bit more fully and completely — without inventing new facts.",
  "capture.ai.instr.spelling": "Correct spelling and grammar only.",
  "capture.ai.instr.format":
    "Only improve readability with clean paragraphs and punctuation. Do NOT use markdown characters like #, ## or * — no heading markers. Keep content and wording unchanged; add or remove nothing.",
  "capture.ai.help.clarify": "Rephrases more clearly and precisely — the meaning stays the same.",
  "capture.ai.help.structure": "Arranges the text into concise sentences or bullet points.",
  "capture.ai.help.expand": "Phrases more fully — without inventing new facts.",
  "capture.ai.help.spelling": "Corrects spelling and grammar only, nothing else.",
  "capture.ai.help.format":
    "Only improves readability (paragraphs, punctuation) — without markdown characters; the content stays verbatim.",
  // SCRUM-386: ?-help for custom functions — the instruction is openly visible (G-3).
  "capture.ai.customHelp":
    "Custom AI function of your organisation (created by the admin). Instruction for the AI: „{{instruction}}“. As with all AI actions, only a suggestion for preview is produced — nothing is adopted unless you deliberately click to adopt it.",
  "capture.ai.presetsFailed": "The custom AI functions of your organisation could not be loaded.",
  "capture.ai.freeLabel": "Your own AI instruction",
  "capture.ai.freePlaceholder": "e.g. “phrase it shorter and more factual”",
  "capture.ai.run": "Run",
  "capture.ai.previewTitle": "AI suggestion (preview)",
  "capture.ai.replace": "Replace",
  "capture.ai.append": "Append",
  "capture.ai.discard": "Discard",
  "capture.author": "Author",
  "capture.documents": "Documents (context / attachment)",
  "capture.documentsUpload": "Upload files",
  "capture.uploadLimits":
    "Up to {{count}} files, each max. {{mb}} MB transfer size (roughly {{raw}} MB of plain file).",
  "capture.attachLimitReached":
    "{{taken}} of {{total}} files accepted for processing — the attachment limit is {{limit}}.",
  "capture.documentsHint": "txt, md, csv, json, log, docx, pdf → full text · images: optional OCR",
  "capture.images": "Images (attachment)",
  "capture.imagesUpload": "Attach images",
  "capture.imagesHint": "Also from the mobile app. Attached to the object.",
  "capture.videoAdded":
    "{{name}} attached. Transcription on click — nothing happens automatically.",
  "capture.videoTranscribe": "Transcribe",
  "capture.videoBusy": "running …",
  "capture.videoRunning": "Transcribing {{name}} — short clips are fast.",
  "capture.videoDone": "Transcript of {{name}} inserted — please review (draft, not truth).",
  "capture.saveDraft": "Save as draft",
  "capture.draftSaved": "Draft saved.",
  "capture.draftUpdated": "Draft updated.",
  "capture.bereitsGespeichert": "This document was already saved; no second entry was created.",
  "capture.bereitsGespeichertFortgeschrieben":
    "This document was already saved; no second entry was created. The existing entry now holds your changed version.",
  "capture.bereitsGespeichertOeffnen": "Open the existing entry: “{{title}}”",
  "capture.teilerfolg.dateiAusstehend":
    "Not everything is saved yet: the draft is saved, the file “{{name}}” is still being saved.",
  "capture.teilerfolg.dateiGescheitert":
    "Only partly saved: the draft is saved, the file “{{name}}” is not. It is still here — “Save as draft” tries again.",
  "capture.draftDiscarded": "Draft deleted.",
  // JOB 3768 — see the German entry: since JOB 3668 the draft goes to the recycle bin, so the old
  // “permanently” was a claim the product no longer backs.
  "capture.discardDraftQ":
    "Delete? The draft moves to the recycle bin and can be restored under “My drafts”.",
  "capture.discardDraftKeep": "Keep",
  "capture.discardDraftYes": "Delete",
  "capture.imageError": "“{{name}}” could not be read as an image.",
  "capture.draftFallbackTitle": "Draft",
  "capture.resumeTitle": "Resume drafts",
  "capture.resumeExpand": "Show drafts ({{count}})",
  "capture.resumeCollapse": "Collapse drafts",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` removed — see the DE block.
  "capture.resume": "Resume",
  "capture.discardDraft": "Discard",
  // AUFTRAG-sortfilter · Punkt 2: draft list filter + sort.
  "capture.draftSearch": "Search drafts",
  "capture.draftSortLabel": "Sort",
  "capture.draftSort.recent": "Last saved (new→old)",
  "capture.draftSort.oldest": "Last saved (old→new)",
  "capture.draftSort.title": "Title A→Z",
  "capture.draftAuthorLabel": "Creator",
  "capture.draftAuthorAll": "All creators",
  // AUFTRAG-BASIC-u2 — see the German entry for the finding.
  "capture.draftScope.note":
    "This search covers only your saved drafts — no knowledge from the library.",
  "capture.draftScope.noteAdmin":
    "This search covers only saved drafts (admin view: all of them) — no knowledge from the library.",
  "capture.draftScope.toLibrary": "Search the Klarwerk knowledge",
  "capture.draftEmptyFiltered":
    "No saved drafts match your search. Only drafts were searched — validated knowledge lives in the library.",
  "capture.draftJustSaved": "just saved",
  "capture.draftCreatorMeta": "Creator: {{name}}",
  "capture.draftSavedMeta": "Saved: {{date}}",
  "capture.draftStatusMeta": "Status: draft",
  "capture.editingDraft": "Draft loaded — changes are saved to the same draft.",
  "capture.editingBadge": "editing",
  "capture.fileImportJump": "Import file",
  "capture.loadExample": "Load example",
  "capture.exampleLoaded":
    "Experience note loaded — now structure it with AI and review the draft.",
  "capture.docAdded": "{{name}} added as context.",
  "capture.docExtracting": "Reading {{name}} …",
  "capture.docEmpty":
    "{{name}}: no text found — a scanned PDF without a text layer is not supported yet.",
  "capture.docParseError": "{{name}} could not be read.",
  "capture.docUnsupported":
    "{{name}}: only txt/md/csv/json/log, docx and pdf are read as full text.",
  "capture.ocr": "OCR → text",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning": "Reading the text in {{name}} … The first time takes a little longer.",
  "capture.ocrDone": "OCR text from {{name}} added.",
  "capture.ocrEmpty": "{{name}}: OCR found no text.",
  "capture.ocrFailed": "OCR failed for {{name}}.",
  "capture.ocrUnavailable": "OCR is currently unavailable.",
  "capture.help.category.title": "Category & #tags",
  "capture.help.category.body":
    'The category is a free domain classification (e.g. "Maintenance", "Quality", "Procurement"). Tags are free keywords for findability.',
  "capture.help.validations.title": "Required validations",
  "capture.reviewers.title": "Suggest reviewers (optional)",
  "capture.reviewers.helpTitle": "Suggest reviewers",
  "capture.reviewers.helpBody":
    "Pick colleagues who should review this entry. They receive it as an open review assignment and get notified. Without a selection the entry stays open to all reviewers.",
  "capture.reviewers.none": "No other people in the directory yet.",
  "capture.reviewers.selected": "Selected: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Default: {{n}}",
  "capture.help.validations.body":
    'How many independent confirmations the object needs before it counts as "validated" (1–5, default 3). More = higher bar, more reliable.',
  "capture.modeSoon": "This mode is coming.",
  "capture.fTitle": "Core statement",
  "capture.fStatement": "Statement",
  "capture.fBody": "Detailed content (optional)",
  "editor.bold": "Bold",
  "editor.bodyLabel": "Knowledge page — body text",
  "editor.italic": "Italic",
  "editor.h2": "Heading",
  "editor.h3": "Subheading",
  "editor.ul": "Bulleted list",
  "editor.ol": "Numbered list",
  "editor.link": "Link",
  "editor.panel": "Panel/Callout",
  "editor.guidance.title": "How to use the detailed content",
  "editor.guidance.structure": "Structure: headings (H2/H3) and paragraphs organize the content.",
  "editor.guidance.action": "Actionable knowledge: lists for steps, links as evidence.",
  "editor.guidance.blocks": "Blocks: mark key points as info/note/warning/success.",
  "editor.guidance.ai":
    "AI help: provides suggestions — you review and apply deliberately, no auto-validation.",
  "editor.attach.title": "Attachments in the editor",
  "editor.attach.images": "image(s)",
  "editor.attach.files": "file(s)",
  "editor.attach.imageHint": "can be inserted into the detailed content via the image button.",
  "editor.attach.fileHint":
    "stay visible as attachments/evidence and are not embedded inline — please reference them in the text.",
  // SCRUM-371: object-store-aware media/evidence guidance (images inline · linkable files · session
  // files as evidence). Honest: evidence never replaces validation.
  "editor.media.title": "Images, files & evidence",
  "editor.media.images": "image(s)",
  "editor.media.imageHint":
    "illustrate your knowledge — insert into the content via the image button.",
  "editor.media.linkable": "linkable file(s)",
  "editor.media.linkableHint":
    "safe to link as evidence/context in the text (internal object reference, no raw-download trick).",
  "editor.media.evidence": "file(s) as attachment",
  "editor.media.evidenceHint":
    "stay as evidence — linkable in the text after saving; until then no makeshift/fake link.",
  "editor.media.note":
    "Evidence improves traceability, but it is not approval — the review decides.",
  "editor.quality.title": "Content check",
  "editor.quality.hint": "Checks structure, not factual correctness. No validation.",
  "editor.quality.empty": "No detailed content yet.",
  "editor.quality.thin": "Very short content — add context or steps if needed.",
  "editor.quality.headings": "Headings",
  "editor.quality.lists": "Lists",
  "editor.quality.blocks": "Blocks",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Attachments present but not mentioned in the text — consider referencing them.",
  "editor.template.title": "Start from a structure template",
  "editor.template.hint":
    "Select a template, review the preview and apply it consciously. Starting structure/suggestion — existing content is not replaced when appended; nothing is saved or validated automatically.",
  "editor.template.selected": "Selected template",
  "editor.template.preview": "Preview",
  "editor.template.procedure.label": "Procedure",
  "editor.template.procedure.description": "Conditions and steps for repeatable work.",
  "editor.template.troubleshooting.label": "Issue",
  "editor.template.troubleshooting.description":
    "Capture symptom, cause and action in a structure.",
  "editor.template.safety.label": "Safety",
  "editor.template.safety.description": "Warning, safe check and desired state.",
  "editor.template.checklist.label": "Checklist",
  "editor.template.checklist.description": "Checkable items plus “what to do if not met”.",
  "editor.template.handover.label": "Handover/training",
  "editor.template.handover.description":
    "The essentials for the next person: key points, typical mistakes, contacts.",
  "editor.template.decision.label": "Decision aid",
  "editor.template.decision.description":
    "If-then rules for a recurring decision, incl. escalation limit.",
  "editor.template.applySet": "Insert template",
  "editor.template.applyAppend": "Append template below",
  "editor.template.applyHelp":
    "Inserts the shown starting structure into the knowledge page: if the page is empty it is inserted; if there is content already, it is appended BELOW — nothing is replaced or saved. Replace the placeholders (“add …”) with your knowledge afterwards.",
  "editor.template.mode.set": "Empty content: the template will be inserted.",
  "editor.template.mode.append":
    "Existing content: the template will be appended; nothing is replaced.",
  "editor.applySafety.replaceWarning":
    "Careful: Replace overwrites the current content. Append keeps what is already there.",
  "editor.block.info": "Info",
  "editor.block.note": "Note",
  "editor.block.warning": "Warning",
  "editor.block.success": "Success",
  "editor.image": "Image from attachment",
  "editor.para": "Paragraph",
  "editor.imageLabel": "Image",
  "editor.fileLabel": "File",
  "editor.aiLabel": "AI",
  "editor.aiToggle": "AI writing help — opens the AI palette",
  "editor.noImages": "No image attachments yet.",
  // SCRUM-456: insert an image straight from the computer + heading for existing attachments.
  "editor.imageFromDisk": "Image from computer …",
  "editor.fileFromDisk": "Attach file from computer …",
  "editor.imageFromAttachment": "From attachments",
  "editor.imageSearch.open": "Image from the library …",
  "editor.imageSearch.title": "Image from the library",
  "editor.imageSearch.label": "Search image caption or description",
  "editor.imageSearch.placeholder": "e.g. bolted joint",
  "editor.imageSearch.submit": "Search",
  "editor.imageSearch.idle":
    "Enter a keyword — the search covers the image captions of the entries you are allowed to read.",
  "editor.imageSearch.loading": "Searching …",
  "editor.imageSearch.refreshing": "As of {{zeit}} · refreshing …",
  "editor.imageSearch.checked": "checked {{zeit}}",
  "editor.imageSearch.empty": "No image with this description in the library (checked {{zeit}})",
  "editor.imageSearch.error": "Search not possible",
  "editor.imageSearch.offline": "Search not possible — no connection",
  "editor.imageSearch.stale": "As of {{zeit}} · refresh failed",
  "editor.imageSearch.capped": "More results than shown — narrow the search.",
  "editor.imageSearch.herkunft": "from “{{quelle}}”, version {{version}}, {{pruefstand}}",
  "editor.imageSearch.noCaption": "no description",
  "editor.imageSearch.nameLabel": "Name: {{name}}",
  "editor.imageSearch.foundVia": "Found via: {{felder}}",
  "editor.imageSearch.via.beschreibung": "description",
  "editor.imageSearch.via.name": "name",
  "editor.imageSearch.thumbAlt": "Image from the library: {{caption}}",
  "editor.imageSearch.use": "Use",
  "editor.imageSearch.useLabel": "Use image “{{caption}}” with caption and provenance",
  "editor.imageSearch.close": "Close",
  "editor.captionPlaceholder": "✎ Add image description …",
  "editor.captionAmbiguous": "Caption in the document, but not clearly assignable",
  "editor.captionUnassigned": "not linked to an image yet",
  "editor.captionUnassignedLabel":
    "Image description, not linked to an image yet — opens the description form",
  "editor.assignHeading": "Which image does this description belong to?",
  "editor.assignImageName": "Image {{n}}",
  "editor.assignOptionLabel": "Link this image description to image {{n}}",
  "editor.assignNoImage": "There is no image in this text it could be linked to.",
  "editor.assignAllDescribed": "Every image in this text already has an image description.",
  "editor.assignUnclear_one":
    "For {{count}} image in this text it is not established which description belongs to it — it is therefore not offered.",
  "editor.assignUnclear_other":
    "For {{count}} images in this text it is not established which description belongs to them — they are therefore not offered.",
  "editor.assignFailed":
    "This link is no longer possible; the text has changed since you opened the form. The choice below has been collected afresh.",
  "editor.assignPreviewMissing": "Preview unavailable",
  "editor.captionNoAnchor":
    "No image description can be added for this image right now. Please insert the image again.",
  "editor.kennungGetrennt_one":
    "Several images carried the same identifier. {{count}} link was separated — please check the image descriptions concerned.",
  "editor.kennungGetrennt_other":
    "Several images carried the same identifier. {{count}} links were separated — please check the image descriptions concerned.",
  "editor.kennungGetrenntClose": "Close the notice about separated image identifiers",
  "editor.kennungUngueltig_one":
    "{{count}} image or image description had an invalid identifier. It was discarded and replaced — please check the assignment.",
  "editor.kennungUngueltig_other":
    "{{count}} images or image descriptions had an invalid identifier. It was discarded and replaced — please check the assignment.",
  "editor.kennungUngueltigClose": "Close the notice about invalid image identifiers",
  "editor.fremdfassungVerworfen":
    "While you were writing, a newer version arrived from elsewhere. Your own text was kept; the other version was discarded.",
  "editor.fremdfassungVerworfenClose": "Close the notice about the discarded version",
  "editor.captionAi.suggest": "Suggest AI description",
  "editor.captionAi.loading": "Creating AI description …",
  "editor.captionAi.panelTitle": "Suggestion",
  "editor.captionAi.aiBadge": "AI-generated. Please review.",
  "editor.captionAi.withContext":
    "Generated with document context (title, heading and surrounding text).",
  "editor.captionAi.apply": "Apply",
  "editor.captionAi.discard": "Discard",
  "editor.captionAi.tooLarge": "The image is too large for a description suggestion (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "The image of this caption could not be read.",
  "editor.captionAi.fallbackNoModel":
    "No AI model is configured or allowed — without a model there is no description suggestion (nothing is invented).",
  "editor.captionAi.fallbackTimeout":
    "The cloud AI exceeded the time limit — so there is no suggestion. Please try again later.",
  "editor.captionAi.fallbackError":
    "The cloud AI is currently unreachable or reports an error — so there is no suggestion. Please try again later.",
  "editor.captionAi.fallbackConfidential":
    "This image is classified as confidential — the cloud AI is excluded for it and no local vision model is wired. So there is no suggestion (nothing leaves the server).",
  // JOB 2402 D1 (TV1 Scheibe b) — see the German entry for the reasoning.
  "editor.titleSuggest.label": "Title suggestion",
  "editor.titleSuggest.apply": "Use as title",
  "editor.titleSuggest.none":
    "No title could be derived from this image — your title stays as it is.",
  // JOB 2489 D1 (TV1 rank 1) — see the German entry for the reasoning.
  "editor.titleSuggest.sourceText": "From the text of this contribution.",
  "editor.titleSuggest.sourceImage":
    "From the image description — your contribution has no text yet.",
  "editor.captionForm.open": "Edit image description",
  "editor.captionForm.title": "Image description",
  "editor.captionForm.label": "Description of the image",
  "editor.captionForm.placeholder": "What can be seen in the image, and why is it here?",
  "editor.captionForm.limit": "{{n}} of {{max}} characters",
  "editor.captionForm.limitReached": "Maximum length reached ({{max}} characters).",
  "editor.captionForm.append": "Append to the text",
  "editor.captionForm.save": "Save description",
  "editor.captionForm.cancel": "Cancel",
  "editor.captionForm.imageAlt": "Image being described",
  "editor.captionForm.noSuggestionYet":
    "No suggestion requested yet. The text stays yours — a suggestion is never adopted automatically.",
  "editor.captionForm.stale":
    "This image has changed in the meantime — the caption was NOT saved, so it cannot end up on the wrong image. Please copy the text, close the form and reopen it on the current image.",
  "editor.captionForm.openLabel": "Edit image description (opens the input form)",
  "editor.captionForm.formatLabel": "Formatting",
  "editor.captionForm.bold": "Bold (Ctrl/Cmd + B)",
  "editor.captionForm.italic": "Italic (Ctrl/Cmd + I)",
  "editor.captionForm.lineBreak": "Line break (Shift + Enter)",
  "editor.captionForm.selectFirst":
    "Select the text you want to mark up first — bold or italic then applies to it.",
  "editor.file": "Link a file",
  "editor.insertFile": "Insert file attachment as a link",
  "editor.noFiles":
    "No linkable files yet — uploaded files become linkable only after saving (with an object reference). Until then they stay as attachments/evidence; no makeshift link.",
  // SCRUM-372: calm drag&drop/paste guidance (only images inline; files stay evidence).
  "editor.drop.hint": "Drag images here or paste them (Ctrl/⌘+V). Files stay as evidence.",
  "editor.drop.hintImagesOnly": "Drag images here or paste them (Ctrl/⌘+V).",
  "editor.drop.imageActive": "Drop media — images are inserted, files stay as evidence",
  "editor.drop.fileNotice":
    "Only images are inserted inline. Files stay as attachments/evidence — a safe body link is only possible with a saved object reference (no fake link). The review decides.",
  "editor.preview": "Preview",
  "editor.edit": "Edit",
  "editor.previewBadge": "Preview — how readers see the page",
  "editor.previewEmpty": "No content yet — switch to “Edit” and write the first section.",
  "editor.linkPrompt": "Enter link URL:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… or internal route",
  "editor.linkLabel": "Link text optional",
  "editor.linkLabelPlaceholder": "If empty, the URL is shown",
  "editor.linkInsert": "Insert link",
  "editor.linkCancel": "Cancel",
  "editor.linkInvalid": "Please use a safe URL (https, mailto, / or #).",
  "capture.fType": "Knowledge type",
  "capture.fCategory": "Domain / category",
  "capture.submit": "Review & submit",
  "capture.submitBusy": "Submitting … (draft, attachments, submission)",
  "capture.submitStageCreating": "Creating knowledge object …",
  "capture.submitStageUploading": "Securing original & attachments ({{mb}} MB) …",
  "capture.submitStageLinking": "Linking sources …",
  "capture.submitTiming.title": "Timing details",
  "capture.submitTiming.create": "Create knowledge object",
  "capture.submitTiming.upload": "Upload original & attachments",
  "capture.submitTiming.link": "Linking & sources",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Save check",
  "capture.ready.title": "Title",
  "capture.ready.content": "Statement / content",
  "capture.ready.category": "Category",
  "capture.ready.type": "Knowledge type",
  "capture.ready.attachments": "Attachments",
  "capture.readyDone": "ok",
  "capture.readyMissing": "missing",
  "capture.readyOptional": "optional",
  "capture.readyHint": "Title and statement/content are required to save.",
  "capture.draftHint":
    "Enter an experience note and structure it with AI — the draft appears here.",
  "capture.fConditions": "Conditions",
  "capture.fMeasures": "Measures",
  "capture.fTags": "Tags",
  "capture.fAsset": "Equipment / machine",
  "conf.field": "Confidentiality",
  "conf.confirmPending": "— confirm confidentiality —",
  "conf.requiredHint": "Please choose a confidentiality level before submitting.",
  "conf.help":
    "How confidential is this knowledge? “Public-internal” is the default (no restriction). “Confidential” and “Strictly confidential” mark sensitive knowledge: such objects are never sent into external contexts (output factory/export). The level can be set while capturing and changed anytime afterwards — every change is recorded in the audit log. Note: this label does not (yet) restrict WHO can see the object.",
  "conf.level.intern": "Public-internal",
  "conf.level.vertraulich": "Confidential",
  "conf.level.streng_vertraulich": "Strictly confidential",
  "conf.level.nichtEingestuft": "Not classified",
  "capture.fRevalidation": "Re-validate after (count)",
  "capture.listAdd": "Add item",
  "capture.listRemove": "Remove",
  "capture.tagPlaceholder": "Type a tag, press Enter",
  "capture.formularHint":
    "Core statement and statement are enough to start — the further details below are optional.",
  "capture.diktatStart": "Start dictation",
  "capture.diktatStop": "Stop dictation",
  "capture.diktatUnsupported":
    "Speech input is not supported by this browser. Use Chrome/Edge or type the text manually.",
  "capture.diktatNa": "not available",
  "capture.ivStep": "Question {{n}} of {{total}}",
  "capture.ivBack": "Back",
  "capture.ivNext": "Next",
  "capture.ivFinish": "Create draft",
  "capture.ivDone": "Interview complete — review the draft on the right and submit it.",
  "capture.ivStart": "Start interview",
  "capture.ivStartLead":
    "The guided interview uses AI to ask follow-up questions. Only when you click “Start interview” does the first question go to the model — nothing is sent before that. Provider and region are shown via the (!) icon.",
  "capture.ivTurn": "Question {{n}}",
  "capture.ivThinking": "The AI is forming the next question …",
  "capture.ivResumeLead":
    "Your interview progress has been restored. The next question loads only when you click.",
  "capture.ivResumeLoad": "Load next question",
  "capture.unsavable.images_one": "{{count}} inserted image",
  "capture.unsavable.images_other": "{{count}} inserted images",
  "capture.unsavable.docs_one": "{{count}} attached file (document/video/audio)",
  "capture.unsavable.docs_other": "{{count}} attached files (documents/video/audio)",
  "capture.unsavable.file": "the uploaded file “{{name}}” — its processing has not finished yet",
  "capture.unsavable.fileQueue":
    "the running file processing from “{{name}}” (point {{current}} of {{total}})",
  "capture.unsavable.extResults":
    "the loaded external search results — the search query itself stays in the draft",
  // AUFTRAG-mega6 Block A
  "capture.unsavable.sourceUrl":
    "the partial web address “{{urls}}” — the draft only saves complete addresses starting with https:// or http://; the source label and excerpt are kept",
  "capture.sourceUrlLimit":
    "The draft cannot save this address. Add https:// or http:// in front — or clear the field if you do not need it.",
  // AUFTRAG-mega6 Block D
  "capture.limit.chars": "Maximum length reached ({{max}} characters) — further text is not saved.",
  "capture.limit.reviewers":
    "The draft cannot save more than {{max}} reviewers — deselect someone to swap.",
  "capture.limit.sources":
    "The draft cannot save more than {{max}} sources — remove one to make room.",
  "capture.limit.interviewAnswers":
    "The draft cannot save more than {{max}} answers — finish the interview or save the draft.",
  "capture.saveLimit.title": "The draft cannot save everything",
  "capture.saveLimit.lead":
    "Text, metadata and sources will be saved. However, the draft cannot save the following content — saving will discard it:",
  "capture.saveLimit.cancel": "Cancel — keep the content",
  "capture.saveLimit.confirm": "Save anyway and discard this content",
  "capture.leaveDraft.action": "Leave draft",
  "capture.leaveDraft.keepsDraftHint":
    "Discards the changes made since you opened it. The saved draft remains unchanged.",
  "capture.leaveDraft.busy": "Not possible while an operation on this draft is running.",
  "capture.leaveDraft.done":
    "Draft left. The changes made since you opened it were discarded, the saved draft is unchanged.",
  "capture.leaveDraft.doneSaved":
    "Draft left. The changes made since you opened it are stored in the saved draft.",
  "capture.leaveDraft.doneUnchanged": "Draft left. The saved draft is unchanged.",
  "capture.ivAnswerHint": "Your answer …",
  "capture.ivSend": "Send answer",
  "capture.ivReadAloud": "Read aloud",
  "capture.ivReadStop": "Stop",
  "capture.ivDictNa": "Dictation is not available in this browser — please type.",
  "capture.ivModel": "AI model",
  // JOB 3276: s. die deutsche Fassung — Alltagssprache statt „Deterministic fallback".
  "capture.ivFallback": "Fixed backup questions, no AI answer",
  "capture.ivQ.title": "What is it about? Write a short core statement.",
  "capture.ivQ.statement": "Describe the experience/statement in more detail.",
  "capture.ivQ.conditions": "Under which conditions does it apply? One per line.",
  "capture.ivQ.measures": "Which concrete measures/steps? One per line.",
  "capture.ivQ.tags": "Tags for findability? Comma-separated.",
  "capture.ivQHint.title": "e.g. Pre-heat pump P-12 in frost",
  "capture.ivQHint.statement": "What exactly, why, with what effect?",
  "capture.ivQHint.conditions": "One condition per line",
  "capture.ivQHint.measures": "One measure per line",
  "capture.ivQHint.tags": "frost, pump, winter",
  "ask.kicker": "Questions and answers",
  "ask.title": "Ask the plant's knowledge",
  "ask.intro":
    "The answer is source-bound: you see what it rests on — and what state each of those sources is in. If there is no basis, the gap is named openly.",
  "ask.placeholder": "e.g. When must valve X be closed on overpressure?",
  "ask.emptyHint": "Please enter a question first.",
  // AUFTRAG-mega38 BLOCK A: waiting and failure appear WHERE the answer will appear.
  "ask.pending.title": "The question is running against the plant knowledge.",
  "ask.pending.body":
    "Matching sources are being looked up. If there is no solid basis, Klarwerk says so openly — nothing is invented.",
  "ask.error.title": "The question could not be answered.",
  "ask.error.body":
    "The request got stuck on the way. This is NOT a statement about the knowledge — it does not mean there is no answer. Please try again.",
  "ask.error.retry": "Try again",
  "ask.gebremst.titel": "Please wait a moment.",
  "ask.offline": "No connection.",
  "ask.wiederaufnahme.entwurf":
    "Pick up where you left off: your unsent draft is back in the question field.",
  "ask.wiederaufnahme.antwort":
    "Pick up where you left off: this is the answer you last saw, from {{zeit}}, with its sources. It was not generated again — ask the question again to refresh it.",
  "ask.wiederaufnahme.beides":
    "Pick up where you left off: your unsent draft is back in the question field, with the answer you last saw, from {{zeit}}, above it. It was not generated again.",
  "ask.wiederaufnahme.verwerfen": "Discard draft",
  "ask.pruefungGestoert": "Klara could not reliably check the company knowledge just now.",
  "ask.rueckmeldungAbgelaufen":
    "Feedback is only possible up to 30 minutes after the answer. Ask the question again to give it.",
  "ask.rueckmeldungAbgelehnt":
    "Your feedback was not accepted. Ask the question again and then try once more.",
  "ask.refreshFailed": "Refresh failed — this answer is from the previous request.",
  // SCRUM-295: hint for a prefilled start question (from KO detail “Use knowledge”) in demo context.
  "ask.demoPrefillHint":
    "Start question taken from the knowledge object — click “Ask”. The answer stays source-bound; status and trust decide, nothing is secured automatically.",
  "ask.examplesLabel": "Examples:",
  "ask.examplesSendHint": "One click asks right away — the question is sent immediately.",
  "ask.example.valve": "What to do when Ventil X must close on Überdruck (overpressure)?",
  "ask.example.filter": "How often must Filter F3 be checked?",
  "ask.example.dosing":
    "Why does the Dosierwert on Linie L4 fluctuate after each Schichtwechsel (shift change)?",
  "ask.expect.answer": "finds matching knowledge",
  "ask.expect.gap": "shows a knowledge gap",
  "ask.submit": "Ask",
  // JOB 3038: dictation at the question field — see the note at the German keys.
  "ask.diktatStart": "Speak question",
  "ask.diktatStop": "Stop recording",
  "ask.diktatUnsupported":
    "Speech input is not available in this browser. Use Chrome/Edge or type your question.",
  "ask.reasoner.model": "Model mode",
  "ask.reasoner.deterministic": "Deterministic mode",
  "ask.reasoner.loading": "Checking mode …",
  "ask.reasoner.unknown": "Mode unknown",
  "ask.reasoner.hint":
    "Shows whether answers run via a configured model or the rule-based fallback. Sources and validation stay the same.",
  "ask.fromValidated": "From source-bound knowledge",
  "ask.evidence": "Evidence",
  "ask.knowledgeClass.gesichert": "Verified",
  "ask.knowledgeClass.ungeprueft": "Unchecked",
  "ask.knowledgeClass.meinung": "Opinion/experience",
  "ask.knowledgeClass.extern": "External source",
  "ask.knowledgeClass.annahme": "Assumption",
  "ask.knowledgeClass.unbekannt": "Unknown",
  "ask.steps": "Context sources consulted",
  // AUFTRAG-mega38 BLOCK F — see the DE block: the list is the full top-K retrieval set, not the
  // set of sources the answer actually used.
  "ask.sources": "Sources consulted",
  // JOB 3064 H5 — see the DE block.
  "ask.menu.label": "More about this answer",
  "ask.menu.mehr": "More …",
  "ask.export.copy": "Copy",
  "ask.export.download": "As Markdown",
  "ask.export.print": "Print / PDF",
  "ask.export.docx": "As Word (.docx)",
  "ask.export.pptx": "As PowerPoint (.pptx)",
  "ask.export.pdfDatei": "As PDF file",
  "ask.export.pdfZeichen":
    "The PDF file cannot show these characters unchanged: {{zeichen}}. Nothing was downloaded — Word or Markdown pass the text on without loss.",
  "ask.export.copied": "Answer incl. sources copied.",
  "ask.export.answer": "Answer",
  "ask.export.footer":
    "Source-bound answer from KLARWERK · generated on {{date}}. Only as reliable as the sources used (status/trust). No promise of truth.",
  "ask.sourcesHint":
    "This answer is source-bound — it is only as reliable as the source it uses (status, trust, usability). Listed are all sources consulted for the question; which of them carried the answer is marked. Open the knowledge object for details.",
  // AUFTRAG-mega52 A3/A5 — the answer says what it rests on. Unusable markers mean "unknown", never a guess.
  "ask.attribution.known":
    "The sources listed first carried the answer; the rest were consulted but not used.",
  "ask.attribution.unknown":
    "Which of these sources carried the answer could not be determined — the AI returned no usable source references. The list therefore shows all consulted sources without a marker, and “This helped” is not available here.",
  // R-0310/R-0325: the answer is withheld because no paragraph could be attributed to a source.
  "ask.quellen.weitere": "Show {{count}} more sources",
  "ask.zuordnungUnbekannt":
    "No answer is shown: it could not be attributed to any source. A paragraph without a source is not output.",
  // JOB 3267 Q1 — three states, three words, plus a fourth for the review status (see the German
  // entry for the finding this fixes).
  "ask.attribution.carrying.badge": "used",
  "ask.attribution.carrying.hint":
    "Used: the AI referred to this source explicitly in the answer text — its footnote is in the text.",
  "ask.attribution.consulted.badge": "not used",
  "ask.attribution.consulted.hint":
    "Consulted, not used: this source was available to the AI; no footnote in the answer text refers to it.",
  "ask.attribution.unclear.badge": "unknown",
  "ask.attribution.unclear.hint":
    "Attribution unknown: whether this source carried the answer cannot be shown — the AI returned no usable, or a contradictory, attribution.",
  "ask.pruefstand.hint":
    "Review status of this source: {{stand}}. This says nothing about whether the answer used it.",
  "ask.pruefstand.unbekannt": "Review status unknown",
  // Packet 4 (nacht24): sources like the document — status/trust per source + original-format excerpt.
  "answerSource.trust": "Trust {{n}}",
  "answerSource.excerptShow": "Show excerpt in document format",
  "answerSource.excerptHide": "Hide excerpt",
  // JOB 4224 D5: the path from the citation to the original.
  "answerSource.originalsTitle": "Original",
  "answerSource.noOriginal": "No original is stored for this source.",
  "answerSource.originalFile": "Open the stored original",
  "answerSource.originalAddress": "Open the original address (new window)",
  "answerSource.originalReference": "Reference without a retrievable address",
  // JOB 4224 R3: the THIRD state — neither "blocked" nor "no original", but "not confirmed".
  "answerSource.originalUnconfirmed":
    "The state of this source is not confirmed right now — the evidence is offered again once the refresh succeeds.",
  // JOB 4224 D5 (delivery 5): without a model the page names the permitted path, too.
  "ask.aiUnavailable.adminPfad":
    "As an administrator you can connect an AI model or switch AI on here:",
  "ask.aiUnavailable.toAdmin": "Open AI settings",
  "ask.aiUnavailable.path":
    "Without a model the knowledge base stays open — nothing is enabled automatically for it:",
  "ask.aiUnavailable.toLibrary": "Search the knowledge base",
  "ask.aiUnavailable.toCapture": "Capture knowledge",
  "ask.helpful": "This helped",
  "ask.thanked": "Thanks!",
  "ask.status.verified": "Verified",
  "ask.status.unverified": "Not yet verified",
  "ask.reviewGuard.openLabel": "Do not use as verified knowledge yet",
  "ask.reviewGuard.openHint":
    "At least one source is open or still in review. Review/rate it before using this statement as verified knowledge.",
  "ask.reviewGuard.unverifiedLabel": "Answer is not verified yet",
  "ask.reviewGuard.unverifiedHint":
    "This answer is not classified as verified. Check sources and review status before reusing it.",
  "ask.reviewGuard.cta": "Go to validation",
  "ask.gapBadge": "Knowledge gap",
  // AUFTRAG-mega54 BLOCK E — the one next step for a gap (see the German entry). Order is
  // content: the free step first, capture second, the risk board last.
  "ask.gapNext":
    "Next step: ask the question again using the terms your team actually uses — otherwise capture the knowledge or prioritise the gap in the risk board.",
  "ask.noBasisTitle": "No reliable basis.",
  "ask.noBasisBody":
    "No source matches this question closely enough. Instead of a made-up answer, a knowledge gap was created. Both are possible: the knowledge is still missing — or it is recorded under different terms.",
  // SCRUM-369 / AG-12/13/P2-4: the Ask gap as a guided "rescue this knowledge gap" entry (not a chatbot end).
  "ask.gap.rescueTitle": "Rescue this knowledge gap",
  "ask.gap.rescueImpact":
    "Perhaps this experience knowledge is still missing, perhaps it just cannot be found. You can help secure it — for everyone who asks this later.",
  "ask.gap.noInvent":
    "No answer was made up: without a reliable source the question honestly stays open.",
  "ask.gap.rescueCta": "Capture & rescue knowledge",
  // AUFTRAG-mega54 BLOCK E3: heading sharpened so the steps read as the path for someone who
  // already knows the answer — the step order itself is untouched.
  "ask.gap.stepsTitle": "Do you know the answer? Here is how to contribute it:",
  "ask.gap.step.answer.label": "Answer the question",
  "ask.gap.step.answer.hint": "Put down what you know from experience.",
  "ask.gap.step.experience.label": "Add your own experience",
  "ask.gap.step.experience.hint": "Conditions, measures, context.",
  "ask.gap.step.structure.label": "Let AI structure it",
  "ask.gap.step.structure.hint": "The AI only organises it — it invents nothing.",
  "ask.gap.step.review.label": "Get it reviewed",
  "ask.gap.step.review.hint": "Only after validation it counts as secured.",
  // SCRUM-366 / FR-ASK-02 / PI-K2: answer contract — source-bound, honest, not a generic chatbot.
  "ask.contract.label": "Answer basis",
  // JOB 2626 D1: why there was no answer — the closed gates, per document.
  "ask.verschlossen.titel": "There is content on this — Klara could not base an answer on it.",
  "ask.verschlossen.grund.freigabe": "At least one of these documents has not been released yet.",
  "ask.verschlossen.grund.stufe":
    "At least one of these documents has no confidentiality level yet.",
  "ask.verschlossen.grund.volltext":
    "Klara cannot cite anything from documents without searchable text. You can read them and add the text there.",
  "ask.verschlossen.pruefPfad.beides": "Release or classify:",
  "ask.verschlossen.pruefPfad.freigabe": "Release:",
  "ask.verschlossen.pruefPfad.stufe": "Classify:",
  "ask.verschlossen.zurPruefung": "Go to review",
  "ask.verschlossen.label": "Found — but these gates are closed:",
  "ask.verschlossen.freigabe": "Approval missing",
  "ask.verschlossen.freigabeHint": "The document has not been approved yet.",
  "ask.verschlossen.stufe": "Level missing",
  "ask.verschlossen.vertraulichkeitsstufe": "Confidentiality level missing",
  "ask.verschlossen.stufeHint": "No confidentiality level is set for the document.",
  "ask.verschlossen.volltext": "No searchable text",
  "ask.verschlossen.volltextHint": "No searchable text of this document is available yet.",
  // JOB 3109 UX-09: accessible name of the read link, and the one sentence that separates
  // „approved" from „was allowed to carry this answer".
  "ask.verschlossen.lesen": "Read report: {{titel}}",
  "ask.verschlossen.trennung":
    "Approved and usable as a basis for an answer are not the same thing: an approved document may still not carry here — and a document you may open need not have answered this question.",
  "ask.contract.verified.title": "Source-bound answer",
  "ask.contract.verified.body":
    "This answer draws on validated knowledge from your knowledge base — not a generic chatbot answer.",
  "ask.contract.verified.next": "Next step: open the source or use the knowledge.",
  "ask.contract.unverified.title": "Source-bound, but not verified yet",
  "ask.contract.unverified.body":
    "The answer draws on existing but not-yet-verified knowledge. It is marked as unverified, not a chatbot guess.",
  "ask.contract.unverified.next":
    "Safe next step: send it for review or have it checked in validation.",
  "ask.contract.gap.title": "Knowledge gap, not a chatbot answer",
  "ask.contract.gap.body":
    "No source matches this question closely enough to carry an answer. That does not necessarily mean the knowledge is missing — it may simply be recorded under different words. Either way it's a gap you can close, not an error.",
  "ask.contract.trustNote":
    "Trust and usability show how reliable a source is — not a guarantee of truth.",
  // AUFNAHME 20260922 · Antwort-Erklärung (Begründung im deutschen Block).
  "ask.belastbarkeit.titel": "How reliable is this?",
  "ask.belastbarkeit.lage.belegt": "Backed by sources",
  "ask.belastbarkeit.lage.belegt_zustaendig_fehlt": "Backed — responsible person not reachable",
  "ask.belastbarkeit.lage.belegt_mit_konflikt": "Backed — with a contradiction",
  "ask.belastbarkeit.lage.wissensluecke": "Knowledge gap",
  "ask.belastbarkeit.lage.technischer_fehler": "Technical error",
  "ask.belastbarkeit.lage.geschwaerzt": "Redacted",
  "ask.belastbarkeit.anzahl": "{{tragend}} of {{herangezogen}} consulted sources carry the answer",
  "ask.belastbarkeit.vertrauenswert":
    "Trust value {{wert}} — as reliable as the weakest carrying source (“{{quelle}}”). The library shows the same number on that entry.",
  "ask.belastbarkeit.vertrauenswertKeiner": "No trust value: no carrying source is known.",
  "ask.belastbarkeit.vertrauenswertKurz": "Trust value {{wert}}",
  "ask.belastbarkeit.stand": "As of {{datum}}",
  "ask.belastbarkeit.quelle.validiert": "validated",
  "ask.belastbarkeit.quelle.nichtValidiert": "not validated",
  "ask.belastbarkeit.verantwortung.eigentuemer": "Responsible",
  "ask.belastbarkeit.verantwortung.autor": "No responsible person named, the author applies",
  "ask.belastbarkeit.erreichbar.ja": "reachable",
  "ask.belastbarkeit.erreichbar.nein": "not reachable",
  "ask.belastbarkeit.erreichbar.unbekannt": "reachability unknown",
  "ask.belastbarkeit.grund.keine_tragfaehige_quelle":
    "No source carries an answer to this question.",
  "ask.belastbarkeit.grund.zuordnung_unbekannt": "It is not known which source carries the answer.",
  "ask.belastbarkeit.grund.alle_tragenden_quellen_validiert": "All carrying sources are validated.",
  "ask.belastbarkeit.grund.tragende_quelle_nicht_validiert":
    "At least one carrying source is not validated.",
  "ask.belastbarkeit.grund.pruefnachweis_unvollstaendig":
    "For at least one carrying source, the conflict check is not fully documented.",
  "ask.belastbarkeit.grund.offener_konflikt": "A carrying source is part of an open contradiction.",
  "ask.belastbarkeit.grund.konfliktlage_unbekannt":
    "The conflict status could not be retrieved — that does not mean there is none.",
  "ask.belastbarkeit.grund.zustaendig_nicht_erreichbar":
    "The responsible person is not reachable (no approved account). The knowledge remains usable; follow-up questions need a new owner.",
  "ask.belastbarkeit.grund.erreichbarkeit_unbekannt":
    "Whether the responsible person is reachable could not be determined.",
  "ask.belastbarkeit.grund.verantwortung_nur_autor":
    "For at least one source no responsible person is named; the author applies.",
  "ask.belastbarkeit.konflikt.titel": "Contradiction — both sides",
  "ask.belastbarkeit.konflikt.seite": "Side {{nummer}}",
  "ask.belastbarkeit.konflikt.traegt": "carries this answer",
  "ask.belastbarkeit.konflikt.nichtEinsehbar": "You cannot view this side.",
  "ask.belastbarkeit.konflikt.keinGewinner":
    "No side is chosen. People decide the contradiction under “Conflicts”.",
  "ask.belastbarkeit.hinweis":
    "The trust value says how reliable the sources are. It says nothing about whether something is true.",
  "ask.belastbarkeit.argumentation.titel": "How the answer comes about",
  "ask.belastbarkeit.argumentation.belegstelle": "Evidence passage: “{{stelle}}”",
  "ask.belastbarkeit.argumentation.art.aussage": "Statement",
  "ask.belastbarkeit.woerterbuch.titel":
    "Terms added from the company glossary — not part of the source count and without a trust value:",
  "ask.belastbarkeit.woerterbuch.eintrag": "Glossary entry {{id}}, version {{fassung}}",
  "ask.belastbarkeit.woerterbuch.verantwortlich": "Responsible: {{wer}}",
  "ask.belastbarkeit.woerterbuch.ohneVerantwortung": "No responsible party given",
  "ask.belastbarkeit.woerterbuch.nichtBewertet": "Reliability not assessed",
  "ask.belastbarkeit.argumentation.art.beziehung": "Documented relation",
  "ask.belastbarkeit.argumentation.beziehung.gehoert_zu": "belongs to",
  "ask.belastbarkeit.argumentation.beziehung.ergaenzt": "complements",
  "ask.belastbarkeit.argumentation.beziehung.ersetzt": "replaces",
  "ask.belastbarkeit.argumentation.beziehung.widerspricht": "contradicts",
  "ask.belastbarkeit.argumentation.beziehung.beispiel_fuer": "is an example of",
  "ask.belastbarkeit.argumentation.gesetztVon": "Relation set by {{wer}}",
  "ask.belastbarkeit.argumentation.gestuetztAuf": "Based on: {{quellen}}",
  "ask.belastbarkeit.argumentation.unabhaengig":
    "No relation between these sources is documented — they stand independently side by side.",
  "ask.belastbarkeit.argumentation.art.einwand": "Objection from an open contradiction",
  "ask.belastbarkeit.argumentation.art.vorbehalt": "Caveat",
  "ask.belastbarkeit.argumentation.art.schluss": "Conclusion",
  "ask.belastbarkeit.argumentation.einstufung.verified": "Rating: backed",
  "ask.belastbarkeit.argumentation.einstufung.unverified": "Rating: not fully backed",
  "ask.belastbarkeit.argumentation.einstufung.gap": "Rating: knowledge gap",
  "ask.belastbarkeit.wissensart.bauchgefuehl": "Gut feeling",
  "ask.belastbarkeit.wissensart.best_practice": "Proven practice",
  "ask.belastbarkeit.wissensart.lernkurve": "Learning curve",
  "ask.belastbarkeit.wissensart.technik": "Technical",
  "ask.belastbarkeit.wissensart.negativwissen": "Negative knowledge",
  "ask.belastbarkeit.zuschnitt":
    "Answer and explanation tailored to: {{rolle}}, occasion {{anlass}}.",
  "ask.belastbarkeit.rolle.viewer": "reader",
  "ask.belastbarkeit.rolle.experte": "expert",
  "ask.belastbarkeit.rolle.controller": "reviewer",
  "ask.belastbarkeit.rolle.admin": "administration",
  "ask.belastbarkeit.rolle.unbekannt": "unknown role",
  "ask.belastbarkeit.anlass.dokument": "working on a document",
  "ask.belastbarkeit.anlass.frage": "free question",
  "ask.pruefrahmen.satz":
    "Checked against {{umfang}}: {{verglichen}} matching entries were compared (at most {{hoechstens}} per question), none carries an answer.",
  "ask.pruefrahmen.umfang.validiert": "validated, non-confidential knowledge only",
  "ask.pruefrahmen.umfang.nicht_vertraulich": "all non-confidential knowledge",
  "ask.pruefrahmen.woertlich": "The search was literal, without an AI summary.",
  // JOB 3366: der Satz an einer abgeschnittenen KI-Antwort (Begründung im deutschen Block).
  "ai.truncated.hint": "This answer was cut off at the length limit and may be incomplete.",
  "ask.contract.sumTotal_one": "{{count}} source consulted",
  "ask.contract.sumTotal_other": "{{count}} sources consulted",
  "ask.contract.sumValidated": "{{count}} validated",
  "ask.contract.sumOpen": "{{count}} open/unverified",
  "ask.contract.sumConflict": "{{count}} with conflict",
  "ask.checkCaveat.title": "This answer is not evidenced as free of conflicts.",
  "ask.checkCaveat.badge": "check unproven",
  "ask.checkCaveat.incomplete":
    "For {{unproven}} of {{total}} sources used, conflict and duplicate checking did not run to completion. Not everything was searched — unknown contradictions are therefore not ruled out.",
  "ask.checkCaveat.noCoverage":
    "For {{unproven}} of {{total}} sources used, a check run is recorded but its reach is not evidenced. How far the search went is therefore unknown.",
  "ask.checkCaveat.unchecked":
    "For {{unproven}} of {{total}} sources used, no check run is recorded at all. Contradictions were never searched for there.",
  "ask.checkCaveat.unknown":
    "{{unproven}} of {{total}} sources used cannot be found in the corpus. Nothing can be said about their checking.",
  // AUFTRAG-mega53 B2: the fifth reason — no source could be attributed to this answer at all.
  "ask.checkCaveat.unattributed":
    "This answer cites none of the {{total}} sources it drew on. Which of them actually supports it is therefore unknown — neither the checking state nor a trust value can be attributed to any source.",
  "ask.trust.unattributed": "trust value not attributable",
  // AUFTRAG-mega34 A2: the unknown conflict state.
  "ask.conflictCaveat.title": "The conflict state cannot be retrieved right now.",
  "ask.conflictCaveat.pending":
    "Known contradictions are still loading. Until they arrive, this answer counts as unverified — not because something was found, but because nothing could be looked up yet.",
  "ask.conflictCaveat.failed":
    "Known contradictions could not be retrieved. Whether any source is in an open conflict is therefore unknown; this answer counts as unverified.",
  // SCRUM-283: data-minimising, honest notice about the stored knowledge gap (Ask + Risk).
  "gap.privacyNotice":
    "The question is stored as a knowledge gap — not an answer and not validated knowledge. Please avoid sensitive or personal details; add reviewed experience later.",
  "gap.originalfrage": "Original question",
  "gap.askCount": "asked {{count}}×",
  "gap.ausgangsfrage": "Question behind this knowledge gap",
  "gap.belegbedarf.label": "Missing evidence",
  "gap.belegbedarf.wissensobjekt":
    "No matching knowledge object found — one that answers the question is missing",
  "gap.belegbedarf.unbestimmt": "Undetermined — which evidence is missing cannot be derived",
  "nulltreffer.titel": "Your searches without results",
  "nulltreffer.hinweis":
    "For these terms your search found nothing you are allowed to see — a hint where knowledge may be missing. Only you see this list.",
  "nulltreffer.anzahl": "searched {{count}}×",
  "nulltreffer.erfassen": "Capture knowledge",
  "nulltreffer.eingegrenzt":
    "Searched only within this filter ({{filter}}) — no finding about the whole collection.",
  "nulltreffer.feld.type": "Knowledge type",
  "nulltreffer.feld.status": "Status",
  "nulltreffer.feld.category": "Category",
  "nulltreffer.feld.tag": "Keyword",
  "einzelquelle.titel": "Knowledge only you hold",
  "einzelquelle.satz":
    "Topics with bus factor 1 whose visible knowledge comes only from you: {{count}}",
  "einzelquelle.zeile": "“{{thema}}” — would you like to spend five minutes on it now?",
  "einzelquelle.einstieg": "Start interview",
  "einzelquelle.themaLabel": "Topic",
  "ask.toGaps": "To the knowledge gaps",
  "ask.toCapture": "Capture knowledge",
  "ko.use.ready": "Ready to use",
  "ko.use.in-review": "In review",
  "ko.use.needs-work": "Still in progress",
  // SCRUM-293: SHARED use-readiness wording (KO detail + Library identical) — honest, no fake
  // approval: "usable" only because validated (status/trust support it).
  "use.ready.label": "Usable",
  "use.ready.hint": "Validated — usable source-bound (status/trust support it).",
  "use.review.label": "In review",
  "use.review.hint": "Review in progress — don't use as secured yet.",
  "use.open.label": "To review",
  "use.open.hint": "Open/unverified — get it reviewed first.",
  "ko.ovTrust": "Trust",
  "ko.ovSources_one": "{{count}} source",
  "ko.ovSources_other": "{{count}} sources",
  "ko.ovAttachments_one": "{{count}} attachment",
  "ko.ovAttachments_other": "{{count}} attachments",
  "trust.explain.title": "How should I interpret the review status?",
  "trust.explain.meta":
    "The review status is a review/evidence signal — not a statement about the truth of the content.",
  "trust.explain.band.high":
    "High trust: positively reviewed several times. Still apply your own judgement.",
  "trust.explain.band.mid":
    "Medium trust: only partly reviewed or with caveats (amber). Double-check before critical use.",
  "trust.explain.band.low":
    "Low trust: barely reviewed or has a red rating/conflict. Review or rework it first.",
  "trust.explain.review":
    "Amber, red or an open conflict means: review or rework before relying on it.",
  "ko.nextLabel": "Next action:",
  "ko.next.use": "validated knowledge — can be used in answers/output.",
  "ko.next.review": "validation in progress — finish the open rating.",
  "ko.next.addSource": "add a source/evidence before validating.",
  "ko.next.validate": "send for review to validate it.",
  "ko.cta.use": "Use in Ask",
  "ko.cta.review": "Finish review",
  "ko.cta.addSource": "Go to sources & evidence",
  "ko.cta.validate": "Go to validation",
  "ko.statement": "Statement",
  "ko.createdAt": "Created on",
  // WP-SHIP9-S2 Paket 3 (E2): short-preview disclosure per knowledge object/candidate.
  "ko.preview.show": "Quick preview",
  "ko.preview.hide": "Close preview",
  "ko.preview.label": "Preview",
  // JOB 3326 · reading variant — the texts live in `lib/lesevariante.ts` (see the reasoning there).
  ...lesevarianteTexteEn,
  "ko.createdByName": "by {{name}}",
  "ko.gallery": "Image gallery",
  "ko.galleryCount": "Image {{n}} of {{m}}",
  "ko.galleryClose": "Close",
  "ko.galleryOpen": "Enlarge image {{n}}",
  "ko.galleryPrev": "Previous image",
  "ko.galleryNext": "Next image",
  "ko.galleryEditCaption": "Edit image description",
  "ko.galleryLoss": "{{n}} of {{m}} images from the source file are missing in this draft.",
  "ko.body.readTitle": "Detailed content from the knowledge editor",
  "ko.body.readNote":
    "Blocks and AI suggestions are editorial structure. The status, trust and sources of this knowledge object remain authoritative.",
  "ko.body.readBlocksChip": "structured content",
  "ko.conditions": "Conditions",
  "ko.measures": "Measure",
  "ko.validate": "Rate positively",
  "ko.stillValid": "Still valid",
  "ko.conditional": "Query",
  "ko.reject": "Reject",
  "ko.edit": "Edit",
  "ko.mehr.konflikt": "Conflict",
  "ko.mehr.quellen": "Sources and evidence",
  "ko.mehr.extern": "External knowledge",
  "ko.mehr.beitrag": "Report source or contribution",
  "ko.mehr.provenienz": "Provenance",
  "ko.mehr.kopplung": "Asset coupling",
  "ko.mehr.herkunftskette": "Origin chain",
  "ko.mehr.historie": "History",
  "ko.mehr.belege": "Evidence",
  "ko.mehr.schnappschuesse": "Snapshots",
  "ko.mehr.anhaenge": "Attachments",
  "ko.mehr.nachbarschaft": "Neighbourhood",
  "ko.returnedBanner":
    "This knowledge object was returned from review for rework. Please address the review feedback and save a revision.",
  "ko.rework.title": "Review rework",
  "ko.rework.hint":
    "Triggered by a review decision (query/reject). Editing creates a new version and restarts review — no automatic approval, no automatic return.",
  "ko.rework.edit": "Edit / revise",
  "ko.rework.back": "Back to validation",
  "ko.rework.savedTitle": "Revision saved",
  "ko.rework.savedHint":
    "A new version was created and goes back into review — no automatic approval, no automatic return.",
  "ko.rework.toValidation": "To the revision in validation",
  "ko.rework.feedbackTitle": "Review feedback",
  "ko.rework.feedback.warn": "Query",
  "ko.rework.feedback.down": "Rejection",
  "ko.rework.editTitle": "Rework: address this feedback",
  "ko.rework.editHint":
    "Work through the feedback. Saving creates a new version and restarts the review — no automatic approval.",
  "ko.rework.stepsTitle": "Next work steps",
  "ko.rework.step.feedback": "Address the review feedback",
  "ko.rework.step.revise": "Save the revision (new version, fresh review)",
  "ko.rework.step.back": "Back to the “revised” validation focus",
  "ko.saveEdit": "Save",
  "ko.cancelEdit": "Cancel",
  // JOB 4075 — see the German block for the reasoning behind each sentence.
  "ko.revise.saved": "Saved. The entry now carries your change.",
  "ko.revise.stale":
    "Somebody else has changed this entry in the meantime — nothing was saved. Your text is still here, unchanged.",
  "ko.revise.staleVersion":
    "Somebody else has changed this entry in the meantime, it is now at version {{n}} — nothing was saved. Your text is still here, unchanged.",
  "ko.revise.reload": "Re-read entry",
  "ko.revise.again": "Save against the current version",
  "ko.revise.partialTags": "Your text is saved. The tags did not get through.",
  "ko.revise.partialTagsCategory":
    "Your text is saved. The tags and the category did not get through.",
  "ko.revise.partialCategory":
    "Your text and the tags are saved. The category did not get through.",
  "ko.revise.partialAgain":
    "Press “{{knopf}}” once more — only what is missing goes out again. Your text stays exactly as it is here.",
  "ko.revise.serverNote": "Server message: {{text}}",
  "ko.revise.partialOlder":
    "An earlier state of your text is saved — your latest change is not. Your text is still here, unchanged.",
  "ko.revise.partialForbidden":
    "This cannot continue right now: you are no longer allowed to change this entry. The rest will only be saved once you have the right again.",
  "ko.revise.forbidden":
    "You are not allowed to change this entry right now — nothing was saved. Your text is still here, unchanged.",
  "ko.revise.stalePartial":
    "Someone else has changed this entry in the meantime — your latest change was not saved. An earlier state of your text from before is already in the entry. Your text is still here, unchanged.",
  "ko.revise.stalePartialVersion":
    "Someone else has changed this entry in the meantime, it is now at version {{n}} — your latest change was not saved. An earlier state of your text from before is already in the entry. Your text is still here, unchanged.",
  // JOB 4251 — see the German block for the reasoning behind these three sentences.
  "ko.revise.staleEinordnungTags":
    "Your text is saved. Someone else has changed this entry's classification in the meantime — your tags did not get through. Your input is still here, unchanged.",
  "ko.revise.staleEinordnungTagsCategory":
    "Your text is saved. Someone else has changed this entry's classification in the meantime — your tags and your category did not get through. Your input is still here, unchanged.",
  "ko.revise.staleEinordnungCategory":
    "Your text and your tags are saved. Someone else has changed this entry's classification in the meantime — your category did not get through. Your input is still here, unchanged.",
  // JOB 3667 R3 — see the German block for the reasoning behind each sentence.
  "ko.propose.mustReview":
    "This knowledge object is released. Your change is submitted as a proposal and only takes effect once somebody else accepts it.",
  "ko.propose.optIn": "Have somebody else look at it first instead of releasing it right away",
  "ko.propose.submit": "Submit change",
  "ko.propose.done":
    "Submitted. The entry still carries the released version until somebody else accepts your proposal.",
  "ko.propose.stale":
    "The entry changed while you were writing — nothing was submitted. Your text is still here, unchanged.",
  "ko.propose.staleVersion":
    "The entry is now at version {{n}} — nothing was submitted. Your text is still here, unchanged.",
  "ko.propose.reload": "Re-read entry",
  "ko.propose.again": "Submit against the current version",
  "ko.propose.openTitle": "Open change proposals ({{n}})",
  "ko.propose.fromVersion": "from version {{n}}",
  "ko.propose.take": "Accept and release",
  "ko.propose.reject": "Reject",
  "ko.propose.rejectReason": "Why rejected?",
  "ko.propose.rejectConfirm": "Save rejection",
  "ko.propose.own": "Your own proposal — somebody else has to review it, not you.",
  "ko.propose.body.neu":
    "Detailed content of the proposal — accepting it replaces the current one:",
  "ko.propose.body.gleich": "Detailed content of the proposal — identical to the current one:",
  "ko.propose.body.bleibt":
    "The proposal only changes the statement. The entry's detailed content stays unchanged:",
  "ko.propose.body.entfernt":
    "The proposal DELETES the detailed content: the author cleared it. Accepting it removes the current one; the statement remains.",
  "ko.propose.body.keiner": "No detailed content — neither in the proposal nor in the entry.",
  "ko.propose.onlyFields":
    "Statement and detailed content are submitted. Core statement, knowledge type, domain/category, conditions, measures and tags cannot be changed on this path — they stay as they are.",
  "ko.propose.droppedFields": "These changes are NOT sent along and stay unchanged: {{felder}}.",
  "ko.editNote":
    "Saving bumps the version, resets the rating and sends the object back into review.",
  "ko.revision.title": "Change overview",
  "ko.revision.none": "No changes detected yet.",
  "ko.revision.note":
    "Detects changed fields/structure, not factual correctness. Revising creates a new version and requires review — no automatic approval.",
  "ko.revision.field.title": "Title",
  "ko.revision.field.statement": "Statement",
  "ko.revision.field.body": "Detailed content",
  "ko.revision.field.conditions": "Conditions",
  "ko.revision.field.measures": "Measures",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Category",
  "ko.revision.field.type": "Type",
  "ko.reportConflict": "Report conflict",
  "ko.conflictTitle": "Report a contradiction with another knowledge object",
  "ko.conflictTarget": "Contradicting object",
  "ko.conflictTargetPlaceholder": "Select object …",
  "ko.conflictType": "Conflict type",
  "ko.conflictDesc": "What is the contradiction?",
  "ko.conflictSubmit": "Open conflict",
  "ko.conflictTargetSearch": "Search knowledge object …",
  "ko.conflictTargetEmpty": "No matches",
  "ko.conflictTargetChoose": "Select",
  "ko.conflictTargetShow": "Preview",
  "ko.conflictTargetHide": "Hide preview",
  "ko.provenance": "Provenance",
  "ko.helpfulTitle": "Proven in practice",
  "ko.helpfulHint": "Did this knowledge help you in practice?",
  "ko.helpful": "This helped",
  "ko.helpfulDone": "Thanks for your signal!",
  "ko.helpfulThanks": "Thanks — marked as helpful.",
  "ko.sourceTitle": "Report source/contribution",
  "ko.sourceContribution": "Your contribution / rationale (required)",
  "ko.sourceRef": "Source / URL / reference (optional)",
  "ko.sourceHint": "Saved as a comment on the object for review — not yet a peer-validated source.",
  "ko.sourceSubmit": "Submit contribution",
  "ko.sourceSaved": "Contribution saved as a comment.",
  "ko.sourcesTitle": "Sources",
  "ko.sourcesEmpty": "No external sources yet.",
  "ko.sourcesHint": "External sources are stage 2 and not peer-validated.",
  "ext.title": "Search external source",
  "ext.hint":
    "Server-proxy search. Hits are never auto-imported; attach as an external, non-peer-validated source — not a substitute for internal validation.",
  "ext.placeholder": "Search term …",
  "ext.search": "Search",
  "ext.attach": "Attach as source",
  // JOB 4367: `ext.attachBlocked` and `ext.gate.how` live in `texte/ux08.ts` now.
  // AUFTRAG-mega16 Block A (ben's SB-4): the stage is a real boundary now — it covers EVERY public
  // web address, not just recognised providers.
  "ext.gate.publicUrl":
    "At the configured stage, no source with a public web address can be attached — this applies to every address from the internet, not only to search results.",
  "ext.gate.unanchored":
    "At the configured stage, a source without an address can only be attached if it is a passage from a document held with this knowledge object. Without an address and without a stored document, the server cannot tell it apart from an external search result.",
  "ext.unavailable": "External search is not available.",
  "ext.resumeHint":
    "The results list is not stored with the draft. Your search query is back — run the search again to reload the results.",
  "extpage.kicker": "Research",
  "extpage.title": "External knowledge",
  "extpage.intro": "Search external sources — without opening a knowledge object first.",
  "extpage.note":
    "Read-only research via the server proxy. Nothing is attached or imported here; to adopt a hit, attach it as a source from the knowledge-object detail. No peer validation.",
  "extpage.idle": "Enter a search term to find external sources.",
  "extpage.disabled":
    "External search is disabled on the server (EXTERNAL_SEARCH=off). Please contact ops/Codex.",
  "extpage.noResults": "No hits for this search.",
  "extpage.resultsTitle": "{{n}} hits",
  "ko.sourceLabel": "Source label (required)",
  "ko.sourceUrl": "URL / reference (optional)",
  "ko.sourceExcerpt": "Excerpt / note (optional)",
  "ko.sourceAdd": "Add external source",
  "ko.sourceAdded": "External source added.",
  "ko.sourceRemove": "Remove source",
  "ko.sourceUnvalidated": "external · not peer-validated",
  "ko.sourceValidated": "peer-validated",
  "ko.sourceExternUnchecked": "External · unchecked",
  "ko.lineageTitle": "Origin & history",
  "ko.lineageOrigin": "Origin",
  "ko.lineageTransferred": "(transferred)",
  "ko.lineageVersions": "Version",
  "ko.lineageChanges_one": "{{count}} change",
  "ko.lineageChanges_other": "{{count}} changes",
  "ko.lineageRelated": "Related",
  "ko.lineageAudit": "Recent events",
  // JOB 3384 · UX-26 — s. die Begründung im deutschen Block: „recorded here", nicht „nothing
  // happened".
  "ko.lineageEventsEmpty": "No events are recorded here for this object.",
  "ko.lineageGraphLink": "View in knowledge graph",
  "nb.title": "Knowledge network — neighbourhood",
  "nb.hint":
    "The article you are reading sits in the middle; around it, what belongs to it via shared tags. Click a neighbour to make it the new centre.",
  "nb.empty": "No neighbours via meaningful tags.",
  "nb.back": "Back to “{{title}}”",
  "nb.open": "Open article",
  "nb.makeCenter": "Make “{{title}}” the new centre",
  "nb.svgLabel": "Neighbourhood of “{{title}}”",
  "nb.countAll_one": "{{count}} neighbour in the network",
  "nb.countAll_other": "{{count}} neighbours in the network",
  "nb.countTruncated": "The {{shown}} strongest of {{total}} neighbours",
  "nb.excluded":
    "No edges via ubiquitous tags: {{tags}} — more than half of all objects carry them, so the connection says nothing.",
  // JOB 4153 (WG-ANZEIGE) — the explicitly curated subject-matter relations.
  "wb.titel": "Curated subject-matter relations",
  "wb.hinweis": "Explicitly set and owned by a person. Not derived from shared tags.",
  "wb.herkunft.gesetzt": "curated",
  "wb.herkunft.abgeleitet": "derived from tags",
  "wb.leer": "No relations have been set for this entry.",
  "wb.leerHinweis":
    "That says nothing about whether contradictions exist — it only means nobody has set a relation.",
  "wb.fehler": "The curated relations could not be loaded.",
  "wb.erneut": "Reload relations",
  "wb.standFrisch": "As of {{zeit}}",
  "wb.standAuffrischung": "As of {{zeit}} · refreshing",
  "wb.art.gehoert_zu": "belongs to",
  "wb.art.ergaenzt": "complements",
  "wb.art.ersetzt": "replaces",
  "wb.art.widerspricht": "contradicts",
  "wb.art.beispiel_fuer": "example of",
  "wb.satz.gehoert_zu.quelle": "This entry belongs to “{{title}}”.",
  "wb.satz.gehoert_zu.ziel": "“{{title}}” belongs to this entry.",
  "wb.satz.ergaenzt.quelle": "This entry complements “{{title}}”.",
  "wb.satz.ergaenzt.ziel": "“{{title}}” complements this entry.",
  "wb.satz.ersetzt.quelle": "This entry replaces “{{title}}”.",
  "wb.satz.ersetzt.ziel": "This entry is replaced by “{{title}}”.",
  "wb.satz.widerspricht.quelle": "This entry contradicts “{{title}}”.",
  "wb.satz.widerspricht.ziel": "“{{title}}” contradicts this entry.",
  "wb.satz.beispiel_fuer.quelle": "This entry is an example of “{{title}}”.",
  "wb.satz.beispiel_fuer.ziel": "“{{title}}” is an example of this entry.",
  "wb.satz.ohneRichtung": "“{{title}}” · {{art}} · relation without a direction",
  "wb.satz.richtungUnbekannt": "“{{title}}” · {{art}} · direction not known",
  "wb.urheber": "set by {{urheber}}",
  "wb.gesetztAm": "on {{zeit}}",
  "wb.gesetztAmUnbekannt": "Time unknown",
  "wb.fassung.geaendert":
    "The relation was judged against version {{beurteiltDieser}} of this entry and version {{beurteiltGegen}} of the counterpart; today this entry is at version {{aktuellDieser}} and the counterpart at version {{aktuellGegen}}.",
  "wb.fassung.geaendertOhneRolle":
    "The relation was judged against versions {{beurteiltErste}} and {{beurteiltZweite}} of the two entries; today they are version {{aktuellErste}} and version {{aktuellZweite}}. Which version belongs to which of the two entries is not part of the information.",
  "wb.fassung.unbekannt": "Reference to the version is unknown.",
  "wb.fassung.unveraendert":
    "Neither version has changed since the relation was set (version {{aktuellDieser}} of this entry and version {{aktuellGegen}} of the counterpart).",
  "wb.fassung.unveraendertOhneRolle":
    "Neither version has changed since the relation was set (version {{aktuellErste}} and version {{aktuellZweite}}).",
  "wb.grenze.widerspricht": "“Contradicts” is a note a person is responsible for, not a proof.",
  "wb.grenze.ersetzt": "“Replaces” changes no approval and publishes no successor.",
  "wb.widerruf.knopf": "Withdraw",
  "wb.widerruf.frage": "Withdraw this relation?",
  "wb.widerruf.frageText":
    "The relation is kept on the record and is not deleted. It counts as withdrawn afterwards.",
  "wb.widerruf.ja": "Yes, withdraw",
  "wb.widerruf.nein": "Cancel",
  "wb.widerruf.laeuft": "Sending …",
  "wb.widerruf.erfolg": "Withdrawn. The relation is kept on the record.",
  "wb.setzen.titel": "Set a relation",
  "wb.setzen.suche": "Find a target",
  "wb.setzen.sucheHinweis": "Search by title or by a word from the entry.",
  "wb.setzen.sucheLaedt": "Searching …",
  "wb.setzen.sucheLeer": "No entry found that you are allowed to see.",
  "wb.setzen.sucheFehler": "The search could not be carried out.",
  "wb.setzen.zielWaehlen": "Choose “{{title}}” as the target",
  "wb.setzen.zielGewaehlt": "Target: “{{title}}” · version {{version}}",
  "wb.setzen.zielAendern": "Choose a different target",
  "wb.setzen.art": "Kind of relation",
  "wb.setzen.richtung": "Direction",
  "wb.richtung.gerichtet": "directed — from this entry to the target",
  "wb.richtung.ungerichtet": "undirected — without a direction",
  "wb.richtung.symmetrisch": "symmetric — the same in both directions",
  "wb.richtungKurz.gerichtet": "directed",
  "wb.richtungKurz.ungerichtet": "no direction",
  "wb.richtungKurz.symmetrisch": "symmetric",
  "wb.setzen.knopf": "Set relation",
  "wb.setzen.laeuft": "Sending …",
  "wb.setzen.erfolg": "The relation is set — the server confirmed it.",
  "wb.setzen.fassungUnbekannt":
    "The version of this entry is not known yet. Nothing is sent while it is missing.",
  "wb.setzen.zielFehlt": "Choose a target first.",
  "wb.fehler.keinRecht":
    "You may not set anything here, or one of the two entries is not visible to you. Nothing was saved, your input is kept.",
  "wb.fehler.standVeraltet":
    "The state has changed: this entry is now version {{quelle}}, the target version {{ziel}}. Nothing was set, your input is kept.",
  "wb.fehler.standVeraltetOhneZahlen":
    "The state has changed. The new state is being fetched; nothing was set, your input is kept.",
  "wb.fehler.konflikt":
    "The relation was changed in the meantime. Nothing was written, your input is kept.",
  "wb.fehler.abgelehnt": "The server rejected the operation. Nothing was set, your input is kept.",
  "wb.fehler.unklar":
    "No answer arrived. Whether the relation was set is therefore unclear — the list was reloaded afterwards and shows that state. Your input is kept; if you send it again unchanged, no second relation is created.",
  "wb.fehler.unklarLaedt":
    "No answer arrived. Whether the relation was set is therefore unclear. The list is being reloaded; until it is here, the list above shows an older state. Your input is kept; if you send it again unchanged, no second relation is created.",
  "wb.fehler.unklarNichtGeladen":
    "No answer arrived, and the list could not be reloaded. Whether the relation was set is therefore unclear; the list above shows an older state. Your input is kept; if you send it again unchanged, no second relation is created.",
  "wb.widerruf.unklar":
    "No answer arrived. Whether the withdrawal arrived is therefore unclear — the list was reloaded afterwards and shows that state.",
  "wb.widerruf.unklarLaedt":
    "No answer arrived. Whether the withdrawal arrived is therefore unclear. The list is being reloaded; until it is here, the list above shows an older state.",
  "wb.widerruf.unklarNichtGeladen":
    "No answer arrived, and the list could not be reloaded. Whether the withdrawal arrived is therefore unclear; the list above shows an older state.",
  "wb.fehler.andereAntwort":
    "The server returned a different relation than the one requested. Your request is therefore NOT confirmed. Your input is kept; send it again if you still want it.",
  "wb.fehler.widerrufeneAntwort":
    "For this attempt the server returned a withdrawn relation. It therefore does not count as set. Your input is kept; send it again if the relation should apply.",
  "wb.widerruf.nichtBestaetigt":
    "After the withdrawal the server still reports the relation as active. The withdrawal is therefore not confirmed. Please try again.",
  "graph.legendKuratiert": "curated subject-matter relation",
  "graph.kuratiertCount_one": "{{count}} curated subject-matter relation",
  "graph.kuratiertCount_other": "{{count}} curated subject-matter relations",
  "graph.kuratiertKante": "curated: {{art}} · {{richtung}}",
  "graph.kuratiertGeladen":
    "{{geladen}} of {{gesamt}} subject-matter relations were loaded. The graph shows a limited excerpt.",
  "ko.transferTitle": "Transfer author",
  "ko.transferOriginal": "Original author",
  "ko.author": "Author",
  "ko.authorUnknown": "Unknown person ({{ref}})",
  "ko.authorLoading": "Loading author name …",
  "ko.authorUnavailable": "Author name unavailable",
  "ko.originalAuthor": "Original",
  "ko.transferPick": "Choose new author …",
  "ko.transfer": "Transfer",
  "ko.transferDone": "Author transferred. Original author stays visible.",
  "ko.history": "Versions",
  "ko.evidenceTitle": "Evidence",
  // JOB 3384 · UX-26 — s. die Begründung im deutschen Block: der Belegdatensatz und die Sache,
  // auf die er zeigt, tragen ab hier verschiedene Namen.
  "ko.evidenceEmpty": "No evidence has been recorded for this object yet.",
  "ko.evidenceEmptyCta": "Add a source",
  "ko.evidenceEmptyCtaHint":
    "Add it in the “Sources and evidence” section — that creates the first evidence record",
  "ko.evidenceKind.source": "Evidence for a source",
  "ko.evidenceKind.attachment": "Evidence for an attachment",
  "ko.evidenceToOriginal": "Show original",
  "ko.evidenceToOriginalHint": "Show the original in the “Attachments” section",
  // JOB 4367: `ko.evidenceOriginalDetached` lives in `texte/ux26.ts` now.
  "ko.evCons.title": "Evidence consistency",
  "ko.evCons.status.ok": "consistent",
  "ko.evCons.status.warning": "review",
  "ko.evCons.counts": "Sources {{sources}} · Attachments {{attachments}} · Evidence {{evidence}}",
  // JOB 4367: `ko.evCons.allOk` lives in `texte/ux26.ts` now.
  "ko.evCons.finding.source-without-evidence": "Source without evidence",
  "ko.evCons.finding.attachment-without-evidence": "Attachment without evidence",
  "ko.evCons.finding.evidence-without-source": "Evidence without source",
  "ko.evCons.finding.evidence-without-attachment": "Evidence without attachment",
  "ko.evCons.finding.legacy-inline-attachment": "Legacy inline attachment (no evidence)",
  "ko.evVer.title": "Evidence by version",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Sources {{sources}} · Attachments {{attachments}}",
  "ko.evVer.latest": "latest {{at}}",
  "ko.evVer.without": "Without evidence: {{versions}}",
  "ko.evFresh.title": "Evidence freshness",
  "ko.evFresh.current": "current version backed",
  "ko.evFresh.outdated": "only older versions",
  // JOB 4367: `ko.evFresh.missing` and `ko.evFresh.neutral` live in `texte/ux26.ts` now.
  "ko.evFresh.counts": "v{{version}} · current {{current}} · older {{older}}",
  // JOB 3627: die englische Seite der festen Dienst-Vermerke (de `:3038-3042`).
  "ko.historyNote.created": "created",
  "ko.historyNote.createdFromDocument": "created (document content adopted)",
  "ko.historyNote.createdBackfilled": "created (backfilled)",
  "ko.historyNote.revised": "revised",
  "ko.historyNote.revisedFromDocument": "revised (document content adopted)",
  "ko.snapshotsTitle": "Version snapshots",
  "ko.snapshotsEmpty": "No stored full snapshots yet.",
  "ko.snapshotInitial": "Initial version — no previous diff.",
  "ko.snapshotNoChanges": "No change in the main fields.",
  "ko.snapshotField.title": "Title",
  "ko.snapshotField.statement": "Statement",
  "ko.snapshotField.conditions": "Conditions",
  "ko.snapshotField.measures": "Measures",
  "ko.snapshotField.type": "Type",
  "ko.snapshotField.status": "Status",
  "ko.snapshotField.bodyHtml": "Detailed content",
  "ko.snapshotOpen": "Open version",
  "ko.snapshotClose": "Collapse version",
  "ko.snapshotBodyChars": "{{anzahl}} characters of text",
  "ko.snapshotBodyMissing": "No detailed content is stored for this version.",
  "ko.snapshotReadOnly": "Earlier version v{{version}} · it stays unchanged",
  "ko.snapshotBackToCurrent": "Back to the current version",
  "ko.snapshotCompareTitle": "Compare two versions",
  "ko.snapshotCompareFrom": "earlier version",
  "ko.snapshotCompareTo": "later version",
  "ko.snapshotCompareNeedsTwo": "Comparing needs two stored versions — so far there is only one.",
  "ko.snapshotCompareChoose": "please choose",
  "ko.snapshotCompareHint":
    "Pick two versions — then this shows field by field what differs between them.",
  "ko.snapshotCompareNone": "In the compared fields these two versions do not differ.",
  "ko.snapshotCompareSame": "That is the same version twice — pick two different ones.",
  "ko.snapshotCompareUnknown":
    "One of the two versions is not available right now — the comparison stays open.",
  "ko.snapshotFieldEmpty": "nothing stored",
  "ko.snapshotRestore": "Restore as working version",
  "ko.snapshotRestoreHint": "creates a new, open version from it; this version stays unchanged",
  "ko.snapshotRestoreRunning": "Restoring …",
  "ko.snapshotRestoreDone":
    "Restored. The content of v{{version}} is now the latest version — open and unreviewed; the earlier approval did not come back.",
  "ko.snapshotRestoreStale":
    "Someone else has changed this entry in the meantime — nothing was restored, their work stands untouched.",
  "ko.snapshotRestoreAgain": "Restore anyway, based on the current state",
  "ko.snapshotRestoreOffline": "Without a connection nothing can be restored — your choice stays.",
  "ko.snapshotRestoreNoRight":
    "You can read this version, but not restore it — that needs edit permission.",
  "ko.snapshotRestoreNeedsRelease":
    "This entry is approved — only someone who may approve can restore an earlier state here. Your change goes in as a proposal via “Edit”.",
  "ko.snapshotRestoreIsCurrent": "This is the current state — there is nothing to restore here.",
  "ko.snapshotRestoreNoContent":
    "No stored state is available for this version, so there is nothing to restore.",
  "ko.snapshotRestoredFrom": "restored from version v{{version}}",
  "ko.comments": "Comments",
  "ko.commentsEmpty": "No comments yet.",
  "ko.commentPlaceholder": "Write a comment …",
  "ko.commentAdd": "Comment",
  // JOB 4146: „resolved" — never „approved"/„released"/„reviewed" (see the German block).
  "ko.diskussion.titel": "Discussion",
  "ko.diskussion.version": "on version v{{version}}",
  "ko.diskussion.versionVeraltet":
    "on version v{{version}} · the entry has since moved on to v{{aktuell}}",
  "ko.diskussion.versionUnbekannt": "Version reference unknown",
  "ko.diskussion.antworten": "Reply",
  "ko.diskussion.antwortAn": "Reply to {{name}}",
  "ko.diskussion.antwortSenden": "Send reply",
  "ko.diskussion.antwortAbbrechen": "Cancel",
  "ko.diskussion.erledigtVon": "resolved · {{name}} · {{datum}}",
  "ko.diskussion.wiederGeoeffnetVon": "open again · {{name}} · {{datum}}",
  "ko.diskussion.alsGeklaertMarkieren": "Mark as resolved",
  "ko.diskussion.wiederOeffnen": "Open again",
  "ko.diskussion.sendeFehler":
    "Your post was not saved. Your text is still in the field — “Send again” sends it straight back out.",
  "ko.diskussion.sendeFehlerVeraltet":
    "Someone else wrote at the same moment. Your text is still in the field — “Send again” attaches it to the latest state.",
  "ko.diskussion.sendeFehlerUnklar":
    "Whether your post was saved is unclear — the connection broke off before an answer arrived. Your text is still in the field. “Send again” will not file it a second time.",
  "ko.diskussion.erneutSenden": "Send again",
  "ko.attachments": "Attachments / photos",
  "ko.attachmentsEmpty": "No attachments yet.",
  "ko.attachmentAdd": "Attach photo",
  "ko.attachmentUploading": "Uploading …",
  "ko.attachmentRemove": "Remove attachment",
  "ko.attachmentOpenNewTab": "Open original in new tab",
  "ko.attachmentPreviewUnavailable": "No preview available",
  "ko.attachmentOriginalUnavailable": "Original unavailable",
  "pruefen.title": "Review",
  "pruefen.handeltAls": "You are reviewing as {{role}}",
  "pruefen.tab.offen": "Open",
  "pruefen.tab.konflikte": "Conflicts",
  "pruefen.tab.duplikate": "Duplicates",
  "pruefen.tab.erneut": "Again",
  "pruefen.menu.actions": "Actions",
  "pruefen.menu.filter": "Filter and focus",
  "pruefen.menu.help": "Help for this surface",
  "pruefen.more": "More",
  "pruefen.images": "{{n}} images",
  "pruefen.kVonN": "{{k}} of {{n}}",
  "pruefen.prev": "Previous entry",
  "pruefen.next": "Next entry",
  "pruefen.reload": "Reload",
  "pruefen.loadError": "Could not be loaded.",
  "pruefen.refreshFailed": "Shown state · refresh failed.",
  "pruefen.lastDecision": "Last",
  "pruefen.mehr.status": "Review state",
  "pruefen.mehr.aiCheck": "AI check",
  "pruefen.mehr.reviewContext": "Review context",
  "pruefen.mehr.zustand": "Status",
  "pruefen.mehr.evidence": "Evidence",
  "pruefen.mehr.effect": "Effect of the decision",
  "pruefen.mehr.recommendation": "Recommendation",
  "dup.redacted.title": "Content withheld",
  "dup.redacted.body": "You may not read at least one side of this finding.",
  "con.redacted.title": "Evidence withheld",
  "con.redacted.body": "You may not read at least one of the two statements.",
  "val.kicker": "Validation board",
  "val.intro":
    "Peer rating green / amber / red. At the threshold (default 3× green, 0× red) an object is validated.",
  // JOB 3290: names the same limit as the German label — the detailed content is not searched.
  "val.filter": "Filter (without detailed content) …",
  "val.filterAllTypes": "All knowledge types",
  "val.filterAllCategories": "All categories",
  "val.filterAllTags": "All tags",
  "val.filterMine": "Assigned to me",
  // WP-SUBMIT-ASYNC: background AI-check status on the card + "in review" filter.
  "val.filterAiPending": "AI check running",
  "val.aiCheck.pending": "Duplicate/overlap check running",
  "val.aiCheck.pendingAi": "Duplicate/conflict check (with AI) running",
  "val.aiCheck.pendingHint":
    "The deterministic duplicate/overlap check is running in the background. The result will appear here once it finishes.",
  "val.aiCheck.pendingHintAi":
    "The duplicate/conflict check (with AI) for conflicts and overlaps is running in the background. The result will appear here once it finishes.",
  "val.aiCheck.failed": "Check failed",
  "val.aiCheck.retry": "Retry check",
  "val.aiCheck.retryStarted": "Check re-queued — it is now running in the background.",
  "val.aiCheck.locked":
    "Duplicate/overlap check running … review actions are locked until the result is in.",
  "val.aiCheck.lockedAi":
    "Duplicate/conflict check (with AI) running … review actions are locked until the result is in.",
  "val.aiCheck.reason.no-model":
    "No AI model active — nothing was checked. Configure a model and retry the check.",
  "val.aiCheck.reason.model-error":
    "The AI check stopped with an error. Retrying starts a fresh run.",
  "val.aiCheck.reason.timeout":
    "The AI check exceeded the time limit and was aborted. Retrying starts a fresh run.",
  "val.aiCheck.reason.model-timeout":
    "The AI model did not respond in time. Retrying starts a fresh run.",
  "val.aiCheck.reason.queue-overflow":
    "The check queue was full — this job was evicted. Retrying re-queues it.",
  // D-AISTATE PAKET 1 (bens V1): confidential → cloud AI excluded, no local model.
  "val.aiCheck.reason.confidential":
    "Confidential — the cloud AI is excluded and no local model is available. Only the deterministic duplicate/overlap check ran; no AI content check was performed.",
  // AUFTRAG-mega11 Block A (bens SB-1): neutral — no statement about protected holdings.
  "val.aiCheck.reason.privacy-no-cloud":
    "For this check the cloud AI is unavailable for data protection reasons, and no local model is ready. Only the deterministic duplicate/overlap check ran; no AI content check was performed.",
  // RT-001 (Pedi): honest classification of real provider errors — never a provider name/key/
  // endpoint/raw error text, only a user-understandable cause plus what the user can do.
  "val.aiCheck.reason.auth":
    "The AI could not sign in — the credentials are missing or were rejected. Please check the model credentials in settings and retry the check.",
  "val.aiCheck.reason.rate-limit":
    "The AI provider rejected the request due to a rate limit. Wait a moment and retry the check.",
  "val.aiCheck.reason.unreachable":
    "The AI provider was unreachable — likely a network or connection issue. Check the connection and retry the check.",
  "val.aiCheck.reason.bad-response":
    "The AI model returned an unintelligible response that could not be evaluated. Retrying starts a fresh run.",
  // AUFTRAG-mega23 Block B: TECHNICAL queueing failure — the model was never asked and raised
  // nothing. The text says exactly that and does not disguise itself as a model error.
  "val.aiCheck.reason.submit-followup-failed":
    "The check could not be queued for technical reasons while submitting — the AI model was not asked and raised nothing. Retrying queues it again.",
  // AUFTRAG-mega28 A2/A3: with the candidate cap in place, a run must never look like it saw the
  // whole library. These texts name the numbers and spell out what an empty result does NOT mean.
  "val.aiCheck.reason.capacity":
    "The check was aborted because the AI model was saturated — it did not run to completion. Retrying starts a fresh run.",
  "val.aiCheck.boardCaveat":
    "This does not mean “checked and clear”: of {{total}} knowledge objects, {{incomplete}} carry an incomplete check run and {{unchecked}} none at all. Detection compares each contribution against a limited set of candidates only.",
  // AUFTRAG-mega31 A4: “no run at all” and “no coverage evidenced” are TWO statements.
  "val.aiCheck.boardCaveat.noCoverage":
    "For {{noCoverage}} more, a check run is recorded but no coverage is evidenced — nothing is established about their reach.",
  "val.aiCheck.coverage.partial": "PARTIAL",
  "val.aiCheck.coverage.capped":
    "Checked against at least {{completed}} of {{available}} possible neighbours — not a complete comparison. The figure is the conservative minimum coverage of both checks (conflict and duplicate); the weaker of the two determines it. No finding means: nothing found within that set, not “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.skipped":
    "Checked against at least {{completed}} of {{available}} possible neighbours; {{skipped}} comparisons were skipped due to errors — the run is incomplete. No finding does not mean “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.aborted":
    "Aborted after at least {{completed}} of {{available}} possible neighbours — the rest was not checked. No finding does not mean “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.unproven":
    "This run is not evidenced as complete: the record shows {{completed}} finished comparisons against {{available}} possible neighbours. No finding does not mean “free of conflicts and duplicates”.",
  "val.feedback.condTitle": "Query – reason for the author (required)",
  "val.feedback.rejTitle": "Rejection – reason for the author (required)",
  "val.feedback.placeholder": "What needs to be revised? …",
  "val.feedback.submit": "Submit",
  "val.feedback.cancel": "Cancel",
  "val.feedback.error": "Could not be saved.",
  // SCRUM-365 / AG-12: frame feedback as help for the next revision, not a technical form.
  "val.feedback.helpHint": "Your feedback helps the author revise the next version specifically.",
  "val.empty": "No open objects.",
  "val.target": "Target: {{n}}× green",
  "val.trust": "Trust",
  "val.votes": "{{have}} of {{need}} green",
  "val.votesTitle": "Validation progress",
  "val.votesHint":
    "This many green (positive) ratings are recorded — out of {{need}} needed to validate. With enough green and 0 red, the object counts as validated; red ratings block approval.",
  "val.votesBlocked": "{{count}}× red",
  "val.staleVotes": "{{count}}× outdated",
  "val.staleVotesHint":
    "These ratings are from an earlier revision (before v{{version}}) and no longer count. The object needs fresh ratings of the current version.",
  "val.markTrue": "Mark as true",
  "val.markTrueConfirm": "Mark as true and fully validate?",
  "val.markTrueCancel": "Cancel",
  "val.markTrueYes": "Yes, validate",
  "val.markTrueDone": "Marked as true — object is now validated.",
  // SCRUM-416: card density — one calm expander for signals/context/guidance.
  "val.more": "Show signals & context",
  // SCRUM-417: edit straight from the board (opens the KO detail in edit mode).
  "val.editKo": "Edit",
  "val.transferred": "Author transferred",
  "val.assigned": "assigned",
  "val.decisionLabel": "Decision pending:",
  "val.reviewContext.new": "New",
  "val.reviewContext.revision": "Revised",
  "val.reviewContext.hint.new": "First review: check source, statement and structure.",
  "val.reviewContext.hint.revision":
    "Review the change: re-assess version and content — no automatic approval.",
  "val.reviewFocus.label": "Review focus",
  "val.reviewFocus.all": "All",
  "val.reviewFocus.new": "New",
  "val.reviewFocus.revision": "Revised",
  "val.focusActive.label": "Active filters",
  "val.focusReset": "Reset filters",
  "val.focusEmpty.filtered": "No matches with the current filters.",
  "val.focusEmpty.otherFilters": "Adjust search, type, category or tag.",
  "val.mineFocus.title": "Review work assigned to you",
  "val.mineFocus.hint": "This is your personal review list. You can work through it now.",
  "val.mineFocus.count": "{{n}} for you",
  "val.mineFocus.reset": "Show all open items",
  "val.mineEmpty.title": "No review work assigned to you",
  "val.mineEmpty.hint":
    "As soon as something is assigned to you, it shows up here. For now there's nothing open for you.",
  "val.mineEmpty.cta": "View all open items",
  "val.decision.low": "weakly backed — review carefully, check sources/evidence.",
  "val.decision.mid": "partly backed — cross-check the statement and sources.",
  "val.decision.high": "well backed — a brief cross-check usually suffices.",
  "val.reviewState.new": "Newly captured · open",
  "val.reviewState.assigned": "Assigned · review running",
  "val.reviewState.inReview": "Review started",
  "val.reviewState.validated": "Validated",
  "val.reviewHint.new": "No review yet — check it now.",
  "val.reviewHint.assigned": "Assigned — the responsible person reviews next.",
  "val.reviewHint.inReview": "Review is running — cross-check sources and statement.",
  "val.reviewHint.validated": "Already validated.",
  "val.confirm": "Confirm",
  "val.conditional": "Conditional",
  "val.reject": "Reject",
  "val.actionApprove": "Approve",
  "val.actionQuery": "Query",
  "val.actionReject": "Reject",
  "val.feedbackRequiredHint": "* Query and rejection require a reason.",
  // SCRUM-365 / AG-12: calm review guidance "What am I reviewing?" (progressive disclosure).
  "val.guide.title": "What am I reviewing now?",
  "val.guide.statement": "Statement",
  "val.guide.statement.hint": "Is the core statement factually correct?",
  "val.guide.evidence": "Source & evidence",
  "val.guide.evidence.hint": "Are sources or evidence present and solid?",
  "val.guide.context": "Context",
  "val.guide.context.hint": "Is it clear when and where this applies?",
  "val.guide.traceable": "Traceability",
  "val.guide.traceable.hint": "Is it described clearly and traceably?",
  "val.guide.focus.revision": "Revised — focus on what changed since the last version.",
  "val.guide.focus.transfer":
    "Authorship was transferred — look extra closely at the statement and evidence.",
  // SCRUM-365 / PI-K2 / AG-P2-3: Trust is a signal, not truth — only the quorum makes it reliable.
  "val.guide.trustNote":
    "Trust is a review signal, not a guarantee of truth. Only enough approvals — the agreed minimum number of reviewers — make knowledge reliable.",
  // SCRUM-365: decision impact BEFORE the click — honest, no automatic release.
  "val.guide.impactTitle": "What does the decision do?",
  "val.impact.up.title": "Approve",
  "val.impact.up.body":
    "Counts as one approval vote. Knowledge becomes usable only when status, the number of approvals and trust support it — nothing is released automatically.",
  "val.impact.warn.title": "Query",
  "val.impact.warn.body":
    "Needs a short reason. Stays review work and helps the author revise specifically.",
  "val.impact.down.title": "Reject",
  "val.impact.down.body":
    "Needs a short reason. Leads to rework — nothing is closed automatically.",
  "val.decisionSaved": "Review recorded.",
  // SCRUM-292: honest follow-up per verdict — no automatic/fake validation.
  "val.outcome.up":
    "Positively rated. If status and trust support it, it can be used source-bound or checked as a next step — this does not validate it automatically.",
  "val.outcome.warn": "Query documented. Stays review work until the open points are resolved.",
  "val.outcome.down": "Rejection documented. Stays review/feedback work.",
  "val.nextViewKo": "View object",
  "val.nextUse": "Use knowledge (ask)",
  "val.nextRework": "Rework in the object",
  "val.assign": "Assign …",
  "val.openDetails": "View details — edit & delete in the object",
  // AUFTRAG-mega38 BLOCK E — s. den DE-Block: die Wand zeigt zuletzt ERFASSTES Wissen, kein
  // gesichertes; sie filtert nicht nach Status.
  "start.livewall.title": "What is happening right now",
  "start.livewall.subtitle": "Recently captured knowledge and knowledge that helped others.",
  "start.livewall.saved": "Recently captured",
  "start.livewall.helped": "Helped",
  "start.livewall.helpedToday": "helped today: {{n}}",
  "start.livewall.savedEmpty": "Nothing captured yet — the first contribution will appear here.",
  "start.livewall.helpedEmpty": "No “helped” feedback yet.",
  "start.livewall.validated": "Newly validated",
  "start.livewall.validatedEmpty": "No validated knowledge yet.",
  "start.livewall.nameConsent":
    "Show my name next to my validated knowledge here. Voluntary and revocable at any time; without consent no name appears.",
  "start.livewall.photoConsent":
    "Show my photo next to my validated knowledge here. Voluntary; “Remove photo” deletes it immediately.",
  "start.livewall.photoAdd": "Choose photo",
  "start.livewall.photoReplace": "Replace photo",
  "start.livewall.photoRevoke": "Remove photo",
  "start.livewall.photoError":
    "The photo could not be saved. Please choose a PNG, JPEG or WebP image.",
  "start.livewall.photoAlt": "Photo of the author",
  "start.livewall.photoOwnAlt": "My photo for the wall",
  "start.livewall.beamerOpen": "Open as projector view",
  "start.livewall.beamerFullscreen": "Full screen",
  "start.livewall.beamerLoading": "Loading …",
  "start.livewall.beamerError":
    "The wall is currently unavailable. It will retry on the next cycle.",
  "start.livewall.beamerStale":
    "No fresh connection — names and photos are hidden until the wall is up to date again.",
  "con.kicker": "Conflict board",
  "con.title": "Resolve conflicts — without losing knowledge",
  "con.intro":
    "Contradictions are compared and classified. Only truth conflicts trigger the human escalation path.",
  "con.empty": "No open conflicts.",
  "conflict.impact.title": "Open conflict — usability limited",
  "conflict.impact.hint":
    "This knowledge has an open conflict. It is not automatically wrong, but should be reviewed before unrestricted use.",
  "conflict.impact.truthTitle": "Open truth conflict — review before use",
  "conflict.impact.truthHint":
    "This knowledge has an open truth conflict. Until resolved it counts as to-review, not as unrestrictedly secured.",
  "conflict.impact.badge": "Conflict open",
  "conflict.impact.cta": "View conflict",
  "kollision.detail.title": "Collision on this object",
  "kollision.detail.dublette":
    "This object overlaps with existing knowledge. You can sharpen or delimit your entry; whether it is merged is decided in review.",
  "kollision.detail.konflikt":
    "There is an open contradiction on this object. You can make your statement more precise and back it up; resolving it is up to review.",
  "kollision.detail.beides":
    "This object overlaps with existing knowledge, and there is an open contradiction. You can sharpen and back it up; merging and resolving are up to review.",
  "kollision.detail.keine": "No open collision on this object.",
  "kollision.start.title": "Collisions on your objects",
  "kollision.start.dublette": "{{n}} of your knowledge objects: overlap with existing knowledge.",
  "kollision.start.konflikt": "{{n}} of your knowledge objects: open contradiction.",
  "kollision.start.beides": "{{n}} of your knowledge objects: overlap or open contradiction.",
  "kollision.start.keine": "No open collision on your knowledge objects.",
  "kollision.lage.laedt": "Being checked — the collision check is still loading.",
  "kollision.lage.erstfehler": "Not currently checkable: the data could not be loaded.",
  "kollision.lage.auffrischungLaeuft": "Last known state — the figures are being refreshed.",
  "kollision.lage.auffrischungGescheitert": "Last known state — the refresh failed.",
  "kollision.lage.pausiert":
    "Last known state — not currently checkable without a network connection.",
  "kollision.lage.pausiertOhneStand": "Not checkable without a network connection.",
  "kollision.wiederholen": "Check again",
  "kollision.wegKonflikte": "View conflicts",
  "kollision.wegDuplikate": "View duplicates",
  "kollision.keineGegenseite": "The other object is not named here.",
  // JOB 3068 / N5 — see the German block: every sentence names WHAT is counted (entries in the
  // library this entry was checked against); the two undocumented cases name no number at all.
  "kollision.deckung.vollstaendig":
    "Checked against {{geprueft}} of {{bestand}} entries in the library — the run is documented as complete.",
  "kollision.deckung.unvollstaendig":
    "Checked against {{geprueft}} of {{bestand}} entries in the library — the run is not documented as complete.",
  "kollision.deckung.unvollstaendigOhneZahlen":
    "The check run for this entry is not documented as complete; how many entries in the library it was checked against is unknown.",
  "kollision.deckung.ohneProtokoll":
    "A check run looked at this entry; how many entries in the library it was checked against is not documented.",
  "kollision.deckung.keinLauf":
    "No check run is recorded for this entry; how many entries in the library it was checked against is therefore unknown.",
  "con.type.truth": "Truth",
  "con.type.experience": "Experience",
  "con.type.context": "Context",
  "con.type.temporal": "Time",
  "con.type.role": "Role",
  "con.status.offen": "Open",
  "con.status.eskaliert": "Escalated",
  "con.status.zweitmeinung": "Second opinion",
  "con.status.geloest": "Resolved",
  "con.escPath": "Escalation path",
  "con.escalate": "Escalate",
  "con.resolve": "Resolve",
  "con.origin.auto": "Automatically detected",
  "con.origin.manual": "Manually created",
  "con.autoConfidence": "Confidence {{percent}}%",
  // SCRUM-486 B: the AI percentage is detection confidence, not proof of the contradiction.
  "con.autoConfidenceCaption": "AI detection confidence — not a proven contradiction",
  "con.collision.at": "Collision on",
  "con.collision.verbatim": "verbatim from the source quote",
  "con.collision.point": "collision point",
  "con.autoWhy": "Reason",
  "con.autoQuoteA": "Evidence A",
  "con.autoQuoteB": "Evidence B",
  "con.dismiss": "False alarm – no contradiction",
  "con.side.left": "Left applies",
  "con.side.right": "Right applies",
  "con.side.both": "Both apply, depending on context",
  "con.side.none": "No contradiction",
  "con.prefill.side": "Authoritative: {{title}}.",
  "con.prefill.both": "Both statements apply, depending on context.",
  "con.resolveConfirm": "Save decision",
  "con.decision": "Decision",
  "con.decisionPlaceholder": "How is the contradiction resolved? (rationale/outcome)",
  "con.versus": "vs",
  "con.conditions": "Conditions",
  "con.measures": "Measures",
  "con.sources": "Sources",
  "con.openKo": "Open object",
  "con.compareOpen": "Compare both",
  "con.readonlyCompare": "Read-only comparison",
  "con.caseList": "All open conflicts ({{count}})",
  "con.detectedOn": "Detected on {{date}}",
  "con.evidenceSideLabel": "Evidence for this side",
  "con.evidenceBalance.neither":
    "Neither statement is backed by a source. This contradiction therefore cannot be settled on wording, only on evidence — the next step is to add a source for at least one side.",
  "con.evidenceBalance.oneSided":
    "Only one of the two statements is backed by a source: “{{title}}”. That is a difference in evidence, not a verdict on which statement is correct — a sourced statement can still be wrong. The next step is to back the other side or withdraw it.",
  "con.compareTitle": "Side-by-side comparison",
  "con.koMissing": "Contribution was removed.",
  "con.resolveEffect":
    "The decision is documented and logged. Object trust/status are NOT changed automatically (no silent overwrite).",
  "con.resolveRevalidate": "Re-validate affected objects manually if needed.",
  "con.secondOpinion": "Second opinion",
  "con.secondOpinionAdd": "Second opinion",
  "con.secondOpinionConfirm": "Save second opinion",
  "con.secondOpinionPlaceholder": "Assessment by a second expert …",
  "con.nextLabel": "Next step",
  "con.next.escalate": "Escalate to a human (truth conflict).",
  "con.next.secondOpinion": "Get a second expert opinion.",
  "con.next.resolve": "Decide and document the resolution.",
  "con.next.done": "Conflict is resolved — nothing pending.",
  "dup.kicker": "Duplicates board",
  "dup.title": "Resolve duplicates — one topic, one source",
  "dup.intro":
    "Overlaps between contributions, detected automatically. Very high text overlap is found even without AI; the subtler cases are checked by the model. You decide: note as related, keep separate, or close as a false alarm. (Each of these decisions records its reason only; it changes nothing in the two contributions.)",
  "dup.empty": "No open overlaps.",
  "dup.relation.identisch": "Identical",
  "dup.relation.a_enthaelt_b": "A contains B",
  "dup.relation.b_enthaelt_a": "B contains A",
  "dup.relation.teilweise": "Partial overlap",
  "dup.relation.verwandt": "Related",
  "dup.status.offen": "Open",
  "dup.status.in_bearbeitung": "In progress",
  "dup.status.geschlossen": "Closed",
  "dup.method.model": "AI check",
  "dup.method.deterministic": "Text match",
  "dup.probable": "Probable duplicate",
  "dup.textIdentical": "Near-identical text",
  "dup.overlap": "{{percent}}% text overlap",
  "dup.confidence": "Confidence {{percent}}%",
  // REVIEW26 (JOB 3469): the leading percentage now carries the name of what it measures.
  "dup.lead.modelConfidence": "{{percent}}% AI confidence",
  "dup.lead.textOverlap": "{{percent}}% text overlap",
  "dup.lead.sectionAverage": "{{percent}}% average field similarity",
  // SCRUM-486 B: honest framing of the leading number — similarity is not proof.
  "dup.leadCaptionModel": "AI likelihood — not a proven duplicate",
  "dup.leadCaptionText": "Word/text similarity — not a proven duplicate",
  "dup.why": "Reason",
  "dup.shared": "Shared statements",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Only in A",
  "dup.onlyB": "Only in B",
  "dup.recommendation": "Recommendation",
  // SCRUM-486 D: no empty "merge" promise — the recommendation points at the real actions
  // (link / keep separate / false alarm). There is no automatic merge.
  "dup.rec.zusammenfuehren": "Strong overlap — link or keep one version",
  "dup.rec.zusammenfuehren_pruefen": "Review overlap — link or keep separate",
  "dup.rec.getrennt_lassen": "Keep separate",
  "dup.rec.verwandt_verlinken": "Link as related",
  "dup.versus": "vs",
  "dup.openKo": "Open object",
  "dup.compareReadonly": "Read-only comparison",
  "dup.compareOpen": "Compare both",
  "dup.compareTitle": "Comparison",
  "dup.koMissing": "Item was removed.",
  "dup.closed": "Closed",
  "dup.setStatus": "Set status",
  "dup.closeReasonLabel": "Closing reason (required)",
  "dup.closeNoteLabel": "Note (optional)",
  "dup.closeSubmit": "Close",
  "dup.reason.merged": "Merged",
  "dup.reason.kept_separate": "Deliberately kept separate",
  "dup.reason.linked_related": "Noted as related",
  "dup.reason.dismissed": "False alarm — not a duplicate",
  "dup.reason.participant_deleted": "Participating item removed",
  "dup.reason.superseded": "No longer applicable",
  "dup.action.dismiss": "False alarm – not a duplicate",
  "dup.action.keepSeparate": "Keep separate",
  "dup.action.linkRelated": "Link as related",
  "dup.side.left": "Keep left",
  "dup.side.right": "Keep right",
  "dup.side.both": "Keep both, note as related",
  "dup.side.none": "Not a duplicate",
  "dup.keepNote": "Keep separate; authoritative: {{title}}.",
  // JOB 3671 — page help of the duplicates board; the reasoning and the checked source lines are
  // written out once at the German keys.
  "dup.seitenhilfe.flaeche.titel": "Duplicates: what this surface shows",
  "dup.seitenhilfe.flaeche.text":
    "You see a pair of almost identical knowledge objects side by side; on narrow windows the two cards sit one below the other — “Keep left” then means the upper card and “Keep right” the lower one. Highlighted in yellow is the part that does not belong to the shared statements: the object’s own part if it appears verbatim in the text, otherwise the remainder around the shared quotes; if neither can be found, the text stays unmarked instead of guessed. The percentage pill is similarity or model probability, not proof of a duplicate. Numbers, shared statements, own parts, recommendation and status live in the “{{mehr}}” disclosure on each card; how duplicates are found in the first place is explained by the “?” next to the heading. If there is more than one pair, the arrows in the header line page through them.",
  "dup.seitenhilfe.entscheidung.titel":
    "What your decision does — and what happens if it was wrong",
  "dup.seitenhilfe.entscheidung.text":
    "All four buttons do the same one thing: they close this finding with the reason you picked and record it with your name and the time. Neither of them changes the two knowledge objects — nothing is merged, nothing is deleted, and even “Keep both, note as related” creates no link inside the objects but records that reason. A closed finding cannot be reopened here: it leaves the list and the number on the tab. Nothing is lost by that, because both objects remain unchanged in “{{bibliothek}}” — if you got it wrong, you change them there. If you do not want to decide yet, choose “Set status” → “In progress” in the “···” menu on the card while the finding is still open; that keeps it open. Deciding is for those who may review knowledge; with a weaker role the way here does not lead to this surface but to a notice telling you which role it needs.",
  // SCRUM-486 (de-densify): lead line per card + neutral "removed" hint instead of a raw UUID.
  "board.koRemoved": "Item removed",
  "board.detailsShow": "Show details",
  "con.leadKicker": "Contradiction",
  "dup.leadKicker": "Overlap",
  // D-BIB (nacht24 packet 5): dynamic facets + subgroups + saved views (local).
  "lib.facet.category": "Department/Category",
  "lib.facet.language": "Language",
  "lib.facet.status": "Status",
  "lib.facet.author": "Author",
  "lib.facet.age": "Age",
  "lib.facet.trust": "Trust",
  "lib.facet.maturity": "Maturity",
  "val.facet.pruefstand": "Review stage",
  "lib.facet.origin": "Origin",
  "lib.facet.type": "Knowledge type",
  "lib.facet.tag": "Tag",
  "facet.active": "Active filters",
  "facet.reset": "Reset all",
  "facet.remove": "Remove {{label}}",
  "facet.result": "Results: {{shown}} of {{total}}",
  "facet.filtered": "filtered",
  "facet.more": "+{{n}} more",
  "facet.moreFilters": "More filters",
  "facet.noMatch": "no matches (conflicting saved view)",
  "lib.facet.lang.de": "German",
  "lib.facet.lang.en": "English",
  "lib.facet.lang.nl": "Dutch",
  "lib.facet.lang.other": "no language tag",
  "lib.facet.ageBucket.d30": "≤ 30 days",
  "lib.facet.ageBucket.d180": "≤ 180 days",
  "lib.facet.ageBucket.y1": "≤ 1 year",
  "lib.facet.ageBucket.older": "older than 1 year",
  "lib.facet.ageBucket.unknown": "age unknown",
  "lib.facet.trustBucket.t0": "Trust 0",
  "lib.facet.trustBucket.t1": "Trust 1–39",
  "lib.facet.trustBucket.t40": "Trust 40–69",
  "lib.facet.trustBucket.t70": "Trust 70+",
  "lib.facet.more": "+{{n}} more",
  "lib.facet.none": "no value",
  // AUFTRAG-mega10 block B: the chip wall becomes a search mask (rail, per-dimension search,
  // openable cap, sticky counter, range filter, filter sheet).
  "facet.searchLabel": "Search in {{label}}",
  "facet.searchPlaceholder": "Search {{label}} …",
  "facet.searchNoHit": "No value matches “{{query}}”.",
  "facet.showAll": "Show all {{n}}",
  "facet.showLess": "Show fewer",
  "facet.restricted": "only values from the selected category",
  "facet.showResults_one": "Show {{count}} result",
  "facet.showResults_other": "Show {{count}} results",
  "facet.countFiltered": "filtered from {{total}}",
  "facet.countAll": "entire stock",
  "facet.openFilters": "Filters",
  "facet.closeFilters": "Close filters",
  "facet.sheetTitle": "Filters",
  "facet.rangeLabel": "Period",
  "facet.rangeFrom": "from",
  "facet.rangeTo": "to",
  "facet.rangeFromPill": "from {{date}}",
  "facet.rangeToPill": "until {{date}}",
  "facet.rangeContradictory":
    "The start date is after the end date — this combination matches nothing.",
  "lib.facet.confidentiality": "Confidentiality",
  "lib.facet.showResults_one": "Show {{count}} entry",
  "lib.facet.showResults_other": "Show {{count}} entries",
  "lib.facet.rangeLabel": "Last changed",
  "lib.views.remember": "Remember this search",
  // AUFTRAG-sortfilter · Punkt 1: hit list sorting.
  "lib.sort.label": "Sort",
  "lib.sort.relevance": "Relevance",
  "lib.sort.title": "Title A→Z",
  "lib.sort.trust": "Trust (high→low)",
  "lib.sort.recent": "Last changed (new→old)",
  "lib.groupBy.label": "Subgroups",
  "lib.groupBy.none": "none",
  "lib.views.label": "Views",
  "lib.views.pick": "Load saved view …",
  "lib.views.namePlaceholder": "View name",
  "lib.views.save": "Save view",
  "lib.views.remove": "Delete view",
  "lib.views.storageHint":
    "Views stay only in this browser. {{ownership}} They are not stored on the server and not transferred to other devices or browsers. Clearing browser data also deletes the views. Saved: {{dimensions}}. Not saved: sort order and window size (“Load more”). The sort order stays unchanged when loading a view; the window size starts over.",
  "lib.views.ownershipSignedIn": "They belong to your current sign-in.",
  "lib.views.ownershipAnon":
    "Without a sign-in, the list is shared by everyone using this browser without signing in.",
  "lib.views.dimension.q": "Search term",
  "lib.views.dimension.facetSel": "Filter selection",
  "lib.views.dimension.range": "Date range",
  "lib.views.dimension.groupBy": "Grouping",
  "lib.views.dimension.segment": "Segment",
  "lib.views.dimension.scope": "Scope",
  "imp.select.deselectLang": "Deselect all {{lang}} · {{n}}",
  // SCRUM-486 (nacht24 packet 3): one calm finding view — what, detection path (honest),
  // both sides linked, grouped per contribution.
  "finding.kind.konflikt": "Conflict",
  "finding.kind.duplikat": "Duplicate",
  "finding.kind.ueberschneidung": "Overlap",
  "finding.way.ki": "with AI",
  "finding.way.deterministisch": "without AI (deterministic)",
  "finding.way.manuell": "created manually",
  "finding.versus": "vs",
  "finding.groupKicker": "Contribution",
  "finding.groupCount": "{{n}} finding(s)",
  // FUNKE (nacht24 packet 6): impact loop — dignified, no gamification circus.
  "funke.sourceAuthor": "from the knowledge of {{name}}",
  "funke.impact.title": "My impact",
  "funke.impact.contributions": "My contributions",
  "funke.impact.validated": "of which validated",
  "funke.impact.cited": "cited in answers",
  "funke.impact.helpful": "marked as helpful",
  "funke.impact.hint":
    "Honest counting from existing evidence: “cited” counts the leading answer source — nothing is estimated or invented.",
  "funke.gaps.title": "Open knowledge gaps",
  "funke.gaps.count": "{{n}} open",
  "funke.gaps.answerCta": "Answer in 2 minutes",
  "funke.gaps.more": "+{{n}} more open gaps — full list under Risk & gaps.",
  "funke.capital.title": "Knowledge capital",
  "funke.capital.secured": "captured knowledge objects",
  "funke.capital.validated": "of which validated",
  "funke.capital.open": "of which open",
  "funke.capital.categories": "answerable topic areas",
  "funke.capital.authors": "active knowledge holders",
  "funke.capital.gaps": "open knowledge gaps",
  "funke.capital.hint": "Only real numbers from the actual stock — no estimates.",
  "lib.export": "Export",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Text (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (print/PDF)",
  // JOB 1119 (D-002) — see the German entry for the finding and the measured search space.
  "lib.searchLabel": "Search the library",
  "lib.ownScope.label": "Scope",
  "lib.ownScope.meine": "My collection",
  "lib.ownScope.alle": "All content",
  "lib.segment.label": "State",
  "lib.segment.alle": "All",
  "lib.menue.weitere": "More actions",
  "lib.menue.bereich": "Area",
  "lib.menue.filter": "Filter",
  "lib.menue.sichten": "Views",
  "lib.menue.sichtSpeichern": "Save view",
  "lib.liste.eintraege_one": "{{count}} entry",
  "lib.liste.eintraege_other": "{{count}} entries",
  "lib.liste.eintraegeUnbekannt": "–",
  "lib.liste.leer": "No entries yet.",
  "lib.liste.leerSuche": "Nothing found.",
  "lib.liste.fehler": "The list could not be loaded.",
  "lib.liste.erneut": "Try again",
  "lib.liste.erfassen": "Capture",
  "lib.liste.offline": "Searching is not possible without a connection.",
  "lib.liste.offlineWeiter": "The search continues on its own as soon as the connection is back.",
  // JOB 3335 · UX-21 — see the German entry.
  "lib.lesemodus.listeEinblenden": "Show result list",
  "lib.lesemodus.listeAusblenden": "Hide result list",
  "lib.lesen.mehr": "More",
  "lib.lesen.belegstelle.markiert": "Supporting passage highlighted.",
  "lib.lesen.belegstelle.nichtGefunden":
    "The cited passage does not appear verbatim in this version of the text.",
  "lib.lesen.belegstelle.andereFassung":
    "The passage belongs to version {{fassung}}; this is version {{aktuell}}. Nothing is highlighted.",
  "lib.lesen.bilder_one": "{{count}} image",
  "lib.lesen.bilder_other": "{{count}} images",
  "lib.lesen.fehler": "The entry could not be loaded.",
  // JOB 3108 · UX-03 — see the German entry for the reasoning.
  "lib.lesen.sprung.quellen": "Sources and evidence · {{count}}",
  "lib.lesen.sprung.quellenLeer": "Sources and evidence · none",
  "lib.lesen.sprung.anhaenge": "Attachments · {{count}}",
  "lib.lesen.sprung.anhaengeLeer": "Attachments · none",
  // JOB 3474 · REVIEW26 — see the German entry for the finding. Same wording as the file import
  // (`capture.originalAttachFailed`: „Original file“).
  "lib.lesen.sprung.originaldatei": "Original file · {{name}}",
  "lib.lesen.sprung.originaldateien": "Original files · {{count}}",
  "lib.lesen.sprung.originaldateienNamen": "Original files · {{count}}: {{names}}",
  "lib.lesen.sprung.anhaengeLeerNebenDatei": "Further attachments · none",
  // JOB 4145 · WIKI-ORIENTIERUNG — see the German entry for the reasoning.
  "lib.lesen.gliederung.titel": "Document outline",
  // AUFTRAG-BASIC-u2 — see the German entry for the finding.
  "lib.allStatus": "All statuses",
  "lib.allTypes": "All knowledge types",
  "lib.allCategories": "All categories",
  "lib.allTags": "All tags",
  "lib.revalidate": "Start re-validation",
  "lib.ask": "Ask",
  "lib.review": "Review",
  "lib.revalidateDone": "Re-validation started.",
  "lib.reimport": "Re-import (JSON)",
  // AUFTRAG-BASIC-u2: the empty state names the SEARCH SPACE — see the German entry.
  // JOB 1119 (D-002) — see the German entry.
  // AUFTRAG-mega59 BLOCK D — see the German entry for the finding.
  "lib.matchIn": "Matched in",
  "lib.match.title": "Title",
  "lib.match.tag": "Tag",
  "lib.match.category": "Category",
  "lib.match.type": "Knowledge type",
  "lib.match.text": "Text",
  "lib.match.caption": "Image description",
  "lib.maturity.all": "All",
  // SCRUM-309: origin filter (complements maturity/search; provenance, not a quality claim).
  "lib.originLabel": "Origin",
  "lib.demoFilter.all": "All origins",
  "lib.demoFilter.demo": "Example data",
  "lib.demoFilter.nonDemo": "Own knowledge",
  "lib.maturity.usable": "Usable",
  "lib.maturity.review": "In review",
  "lib.maturity.open": "To review",
  "lib.resultCount": "Matches: {{n}}",
  "imp.explore.title": "Explore the source",
  "imp.explore.hint":
    "First see what's in the source — volumes, authors, themes and time range. Nothing is imported.",
  "imp.explore.active": "active",
  "imp.explore.soon": "soon",
  "imp.explore.cta": "Next: explore",
  "imp.explore.exploring": "Exploring …",
  "imp.explore.pages": "Pages",
  "imp.explore.sources": "Sources",
  "imp.explore.period": "Time range",
  "imp.explore.authors": "Authors",
  "imp.explore.themes": "Themes",
  "imp.explore.more": "+{{n}} more",
  "imp.explore.withImages": "{{n}} pages contain images.",
  "imp.explore.noAuthor": "(no author)",
  "imp.explore.noTheme": "(no theme)",
  "imp.explore.empty": "Nothing was found in this source.",
  "imp.explore.truncated": "Only the first {{n}} pages were counted — the source is larger.",
  "imp.explore.abbruch.timeout":
    "Result incomplete: Confluence did not respond in time (timeout). {{n}} pages had been read by then.",
  "imp.explore.abbruch.zu_gross":
    "Result incomplete: A response from Confluence was too large and was discarded. {{n}} pages had been read by then.",
  "imp.explore.abbruch.zeitbudget":
    "Result incomplete: The reading time for the space was exhausted. {{n}} pages had been read by then.",
  "imp.explore.failedPages": "{{n}} pages could not be read.",
  "imp.explore.topOf": "top {{n}} of {{total}}",
  "imp.explore.derivedTag": "derived",
  "imp.explore.derivedHint":
    "Theme derived deterministically from the page titles — the source has no labels for these pages.",
  "imp.explore.spaces": "Spaces",
  "imp.explore.alreadyImported": "Of these already imported: {{n}}",
  "imp.explore.alreadyQueued": "Of these already queued for review: {{n}}",
  // AUFTRAG-ic7-import-vision: honest source gallery „where the journey is heading".
  // AUFTRAG-mega67 BLOCK C+D — der Zugangs-Zustand (s. den deutschen Block für die Begründung).
  "imp.access.title": "Access",
  "imp.access.ready.title": "Enabled, credentials in place",
  "imp.access.ready.body":
    "The import is enabled for this installation, and all required credentials are set on the server. Whether they are also valid will show on the first import — it cannot be checked from here without calling Confluence.",
  "imp.access.noCredentials.title": "Enabled, but without credentials",
  "imp.access.noCredentials.body":
    "The import is enabled, but something is still missing. Until that is fixed, no import can start.",
  "imp.access.disabled.title": "Not enabled in this installation",
  "imp.access.disabled.body":
    "The Confluence import is not enabled here. It is switched on at the server; it cannot be toggled from the interface.",
  "imp.access.blocker.missing": "At least one of the required entries is missing.",
  "imp.access.blocker.insecureBaseUrl":
    "All entries are set, but the address is not an https address. Credentials are only sent over encrypted connections — so no access is established.",
  "imp.access.varsTitle": "What this system needs",
  "imp.access.varPresent": "set",
  "imp.access.varMissing": "not set",
  "imp.access.whereSet":
    "These values are set as environment variables on the server — not here. Klarwerk only shows whether they are set, never their content.",
  "imp.access.whoMay": "This can be changed by whoever has access to this installation's server.",
  "imp.access.switchedOff.title": "Switched off by the operator",
  "imp.access.switchedOff.body":
    "The Confluence import is released in this installation but switched off. While it is off, the server rejects every import. Use the button below to switch it on.",
  "imp.access.schalter.an": "Switch import on",
  "imp.access.schalter.aus": "Switch import off",
  "imp.access.schalter.hinweis":
    "Takes effect immediately, without a restart. Credentials are not entered here.",
  "imp.access.schalter.nichtFreigegeben":
    "The import is not released in this installation — the switch only takes effect once it is released on the server.",
  "imp.access.schalter.fehler": "The switch could not be changed. Please try again.",
  "imp.access.lastConnectedUnknown": "No successfully completed import has been recorded yet.",
  "imp.access.lastConnected":
    "Last successfully completed import: {{date}}. Whether it works now, this look back does not say.",
  // JOB 4086 — SharePoint/OneDrive. Die vier Fehlersätze tragen auch hier keine Zahl und kein
  // Serverwort: derselbe Vertrag wie im deutschen Block, nicht eine lockerere Übersetzung.
  "imp.sharepoint.titel": "SharePoint / OneDrive",
  "imp.sharepoint.was":
    "Pick a file from the connected library. Klarwerk fetches it and puts it into the review below — with its name, its original address and its state.",
  "imp.sharepoint.ohneInhalt":
    "The contents of the file are not read. What is taken over is the name, the address and the state of the source; if you need the text, open the file through its address.",
  "imp.sharepoint.listeTitel": "Files you are allowed to see",
  "imp.sharepoint.neuLaden": "Reload list",
  "imp.sharepoint.laedt": "Loading the files …",
  "imp.sharepoint.nichtFrisch": "This list is from a moment ago — it is being refreshed right now.",
  "imp.sharepoint.leer": "Right now there is no file in this library that you are allowed to see.",
  "imp.sharepoint.gedeckelt":
    "There are more files than shown here — this list is shortened. Narrow down the library if the one you want is missing.",
  "imp.sharepoint.stand": "state {{zeit}}",
  "imp.sharepoint.uebernehmen": "Import selected files",
  "imp.sharepoint.uebernahmeLaeuft": "Fetching …",
  "imp.sharepoint.ergebnisTitel": "Fetched from SharePoint",
  "imp.sharepoint.quelleOeffnen": "Open source",
  "imp.sharepoint.schonVorgemerkt": "Already in the review in this state: {{n}}.",
  "imp.sharepoint.verschwunden": "No longer present in SharePoint: {{n}}.",
  "imp.sharepoint.gescheitert": "Not taken over: {{n}}.",
  "imp.sharepoint.nichtsNeu": "Nothing new was taken over from this selection.",
  "imp.sharepoint.neuerStand":
    "Newer state of the source: {{n}}. The older entry is still in the review — accept the newer one.",
  // JOB 4232 — dieselben zehn Sätze, derselbe Vertrag: keine Zahl, kein Statuscode, kein Serverwort.
  "imp.sharepoint.inhaltRegel":
    "For plain text files (.txt) Klarwerk fetches the text along with it. For every other file type only the name, the address and the state are taken over — if you need the text then, open the file through its address. Which applies to which file is shown in the list.",
  // JOB 4232 R2 — dieselbe Trennung: Ankündigung vor der Messung, Zusage erst danach.
  // JOB 4232 R3 — der Grund, warum der Knopf zu ist. Kein gesperrter Knopf ohne Satz.
  "imp.sharepoint.pruefungLaeuft":
    "The contents of the selected files are being checked right now. The import waits for that — so nothing is taken over on a basis nobody knows yet.",
  "imp.sharepoint.pruefungFehlt":
    "For at least one selected file there is no check result. As long as that is the case, nothing is taken over. Reload the list or choose a different file.",
  "imp.sharepoint.vorschau.textdatei": "text file — content is checked before the import",
  "imp.sharepoint.vorschau.laeuft": "checking the content …",
  "imp.sharepoint.vorschau.unlesbar": "not readable as text",
  "imp.sharepoint.vorschau.text": "content comes along",
  "imp.sharepoint.vorschau.leer": "empty",
  "imp.sharepoint.vorschau.nurMerkmale": "attributes only",
  "imp.sharepoint.vorschau.zuGross": "too large for the content",
  "imp.sharepoint.uebernommen.text": "with content",
  "imp.sharepoint.uebernommen.nurMerkmale": "attributes only, no full text",
  "imp.sharepoint.nichtUebernommen.leer":
    "This file is empty — there is nothing to take over, so nothing was created.",
  "imp.sharepoint.nichtUebernommen.zuGross":
    "This file is too large for a knowledge entry. It was not taken over; split it up or open it through its address.",
  "imp.sharepoint.nichtUebernommen.unlesbar":
    "The contents of this file could not be read as text. It was not taken over — half a text would be worse than none.",
  "imp.sharepoint.zugangErneut": "Check access again",
  "imp.sharepoint.weiterInDerPruefung":
    "The files are now in the review further down. Only once a person accepts them there does a knowledge object come out of it.",
  "imp.sharepoint.zugang.ready.titel": "Switched on, credentials in place",
  "imp.sharepoint.zugang.ready.text":
    "The SharePoint import is switched on for this installation, and all required credentials are set on the server. Whether they are also valid shows on the first fetch — that cannot be checked from here without calling SharePoint.",
  "imp.sharepoint.zugang.ohneDaten.titel": "Switched on, but without credentials",
  "imp.sharepoint.zugang.ohneDaten.text":
    "The SharePoint import is switched on, but something is still missing. As long as that is the case, no file can be fetched.",
  "imp.sharepoint.zugang.aus.titel": "Not switched on in this installation",
  "imp.sharepoint.zugang.aus.text":
    "The SharePoint import is not switched on here. It is enabled on the server; it cannot be flipped from the interface.",
  "imp.sharepoint.fehler.nichtEingerichtet":
    "The connection to SharePoint has not been set up in this installation. Whoever has access to the machine of this installation can put it in place there.",
  "imp.sharepoint.fehler.keineBerechtigung":
    "The stored account is not allowed to read this file or library. Have the sharing checked in SharePoint, or choose a different file.",
  "imp.sharepoint.fehler.nichtVorhanden":
    "This file no longer exists in SharePoint. Reload the list and choose a file that is still there.",
  "imp.sharepoint.fehler.verbindungWeg":
    "The connection to SharePoint no longer holds — it has expired or cannot be reached right now. Try again later; only someone with access to the machine of this installation can renew it.",
  "imp.gallery.planned": "planned",
  "imp.gallery.plannedGroup": "Planned ({{count}})",
  "imp.gallery.systemsTitle": "Systems",
  "imp.gallery.filesTitle": "Files",
  "imp.gallery.hintSoon": "In progress — this source is coming soon.",
  "imp.gallery.hintPlanned": "Planned — coming later.",
  "imp.gallery.unconfigured": "not configured",
  "imp.gallery.hintUnconfigured":
    "Present, but not usable: no service is configured for transcription. An administrator can set one up in the admin area.",
  "imp.gallery.elsewhere": "in Capture",
  "imp.gallery.hintElsewhere":
    "This format is already being read in — not on this page, but in Capture Knowledge. This page itself imports JSON only.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON import",
  "imp.gallery.src.jira": "Jira",
  "imp.gallery.src.wordSource": "Word document source (connector)",
  "imp.gallery.src.pdfSource": "PDF document source (connector)",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "Email",
  "imp.gallery.file.json": "JSON",
  "imp.gallery.file.docx": "Word file (.docx)",
  "imp.gallery.file.pdf": "PDF file (.pdf)",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Text/CSV",
  "imp.gallery.file.ocr": "OCR (scan/image)",
  "imp.gallery.file.avtranscript": "Audio/video transcript",
  "imp.select.title": "Narrow the selection",
  "imp.select.hint":
    "Click themes OR describe in one sentence what to import — combining both works too. The preview shows what matches — nothing is imported yet.",
  "imp.select.promptPlaceholder": "e.g. “everything about maintenance and error codes”",
  "imp.select.promptConfidentialLabel": "Does this text contain confidential content?",
  "imp.select.promptConfidentialYes": "Yes/unsure",
  "imp.select.promptConfidentialNo": "No, unproblematic",
  "imp.select.limit": "At most",
  "imp.select.previewCta": "Next: narrow down",
  "imp.select.previewing": "Evaluating …",
  "imp.select.matched": "{{matched}} of {{total}} matches",
  "imp.select.limitedNote": "capped at the limit",
  "imp.select.critAll": "No narrowing — everything would match.",
  "imp.select.critThemes": "Themes",
  "imp.select.critAuthors": "Authors",
  "imp.select.critKeywords": "Keywords",
  "imp.select.critYears": "Years",
  "imp.select.critLimit": "Limit",
  "imp.select.critSpaces": "Spaces",
  // JOB 3356 (IMPORT-FREITEXT-TITEL): die Vorführung läuft auf Englisch — DE und EN sind
  // Abnahmebedingung, NL folgt der Wörterbuch-Parität.
  "imp.select.critTitle": "Title contains",
  "imp.select.titleFallbackInterpreted":
    "This is how the AI read your sentence (criteria above) — none of the loaded pages match it.",
  "imp.select.titleFallbackFound_one": "1 page carries “{{query}}” in its title.",
  "imp.select.titleFallbackFound_other": "{{count}} pages carry “{{query}}” in their title.",
  "imp.select.titleFallbackStale": "Result for: “{{query}}”.",
  "imp.select.titleFallbackStalePending":
    "The new preview is still running — the figures below are from the previous run.",
  "imp.select.titleFallbackStaleError":
    "The new preview failed — the figures below are from the previous run.",
  "imp.select.titleFallbackStaleChanged":
    "The sentence in the field is a different one now — the figures below are from the previous run.",
  "imp.select.titleFallbackNone": "“{{query}}” is not in the title of any loaded page either.",
  "imp.select.titleFallbackCta_one": "Show that 1 page",
  "imp.select.titleFallbackCta_other": "Show those {{count}} pages",
  "imp.select.yearFrom": "from (year)",
  "imp.select.yearTo": "to (year)",
  "imp.select.alreadyImported": "{{n}} already imported",
  "imp.select.alreadyQueued": "{{n}} already queued for review",
  "imp.select.selectedCount": "{{n}} selected",
  "imp.select.importedDeselected":
    "Already imported pages are deselected; re-select them deliberately if needed.",
  "imp.select.queuedDeselected":
    "Pages already queued for review are deselected; re-select them deliberately if needed.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): match-list controls.
  "imp.select.searchPlaceholder": "Search matches (title, author) …",
  "imp.select.selectAll": "Select all",
  "imp.select.deselectAll": "Deselect all",
  "imp.select.groupBy": "Group by:",
  "imp.select.groupNone": "none",
  "imp.select.groupTheme": "by theme",
  "imp.select.groupLanguage": "by language",
  "imp.select.groupFolder": "by folder",
  "imp.select.noFolder": "No source container",
  "imp.select.folderFallbackNoPath":
    "This source provides no folder structure (no parent chain) — showing the previous view.",
  "imp.select.folderFallbackSingle":
    "The source structure yields only a single folder here — showing the previous view.",
  "imp.select.facet.folder": "Folder",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Theme",
  "imp.select.facet.author": "Author",
  "imp.select.facet.language": "Language",
  "imp.select.facetCount_one": "Show {{count}} match",
  "imp.select.facetCount_other": "Show {{count}} matches",
  "imp.select.rangeLabel": "Source date",
  "imp.select.bulkLabel": "Selection",
  "imp.select.groupCount": "{{n}} matches",
  "imp.select.langDe": "German",
  "imp.select.langEn": "English",
  "imp.select.langNl": "Dutch",
  "imp.select.langOther": "No language tag",
  "imp.select.noTheme": "No theme",
  "imp.select.chipNew": "New",
  "imp.select.chipImported": "Already imported",
  "imp.select.chipQueued": "Queued",
  "imp.select.summary": "{{selected}} of {{total}} selected",
  "imp.select.emptyFiltered": "No match for search/filter — adjust the search or filter.",
  "imp.preview.imported": "already imported",
  "imp.preview.queued": "already queued for review",
  "imp.groups.cta": "Next: group & import",
  "imp.groups.needSelection": "Select at least one entry in the preview to continue.",
  "imp.groups.grouping": "Grouping the posts by topic …",
  "imp.groups.retry": "Try again",
  "imp.groups.willGroupWithoutAi":
    "No AI model active — grouping runs by topic without AI (deterministic).",
  "imp.groups.noAi": "Grouped without AI",
  "imp.groups.noAiReason": "Grouped without AI — {{reason}}",
  "imp.groups.reason.confidential": "confidential candidates — cloud AI excluded",
  // AUFTRAG-mega59 BLOCK F1/F2 — see the German entries for the finding.
  "imp.groups.reason.noModel": "no AI model active",
  "imp.groups.reason.timeout": "the AI model did not answer in time",
  "imp.groups.reason.error": "the AI model reported an error",
  "imp.groups.willGroupWithoutAiConfidential":
    "This batch contains confidential or unapproved entries — it will be grouped by theme without cloud AI (deterministic).",
  "imp.groups.aiGrouped": "AI-grouped",
  "imp.groups.groupCount": "{{n}} posts",
  "imp.groups.approve": "Approve",
  "imp.groups.exclude": "Exclude",
  "imp.groups.selectedCount": "{{x}} of {{y}} selected",
  "imp.groups.catchall": "More posts",
  "imp.groups.noTheme": "Without topic",
  "imp.groups.hintImported": "already imported",
  "imp.groups.hintQueued": "already queued for review",
  "imp.groups.hintStale": "older than 1 year",
  "imp.groups.hintShort": "little content",
  "imp.groups.applyCta": "Import selection ({{n}})",
  "imp.groups.applying": "Importing {{x}} of {{y}} …",
  "imp.groups.bilanzTitle": "Import result",
  "imp.groups.bilanzImported": "{{n}} imported",
  "imp.groups.bilanzSkipped": "{{n}} skipped (already imported)",
  "imp.groups.bilanzSkippedQueued": "{{n}} skipped (already queued for review)",
  "imp.groups.bilanzExcluded": "{{n}} excluded",
  "imp.groups.bilanzFailed": "{{n}} failed",
  "imp.groups.bilanzReview":
    "The imported posts are now in the import review — a person decides there about every addition to the knowledge base.",
  "imp.groups.toReview": "Continue to import review ({{n}} open)",
  "imp.groups.failNotFound": "no longer in the current selection",
  "imp.groups.bilanzQueued": "{{n}} already queued (was already in review)",
  "imp.groups.bilanzNotAttempted": "{{n}} not attempted (run stopped after an error)",
  "imp.groups.retryRest": "Import the rest ({{n}})",
  "imp.groups.failHttp": "transfer failed",
  "imp.groups.hintSourceNewer": "source updated since import",
  "imp.groups.bilanzUpdates": "of which updates: {{n}}",
  "imp.groups.expired":
    "The data behind this grouping has expired — the import was stopped and the selection reset. Please group again.",
  "imp.groups.regroup": "Group again",
  "imp.groups.refreshGrouping": "Refresh grouping",
  // JOB 3357: the run identifier of this import, plus its outcome from the server's run record.
  "imp.groups.runHeading": "Run of this import",
  "imp.groups.runIdLabel": "Run ID",
  "imp.groups.runCall": "Call {{n}}",
  "imp.groups.runIdNone": "The server did not record a run for this call.",
  "imp.groups.runOutcomeLoading": "Loading the outcome of this run …",
  "imp.groups.runOutcomeUnavailable":
    "The outcome of this run cannot be retrieved right now. The ID above remains valid.",
  "imp.groups.runOutcomeStale": "State from the last successful query — not the current one.",
  "imp.groups.runOutcomeStaleFailed": "The refresh failed.",
  "imp.groups.runOutcomeStalePaused": "Without a connection the refresh is waiting.",
  "imp.groups.runOutcomeRefreshing": "A refresh is running right now.",
  "imp.groups.runOutcomeOffline":
    "No connection — the outcome of this run has not been read yet. The ID above remains valid.",
  // WP-COCKPIT-LINIE: guided five-step bar + collapsed history (plain language).
  "imp.step.barLabel": "Import in five steps",
  "imp.step.source": "Source",
  "imp.step.sourceHint":
    "Choose where the contributions should come from — today: pages from Confluence.",
  "imp.step.explore": "Explore",
  "imp.step.exploreHint": "First look at what the source contains — nothing is taken over yet.",
  "imp.step.narrow": "Narrow down",
  "imp.step.narrowHint":
    "Click themes or describe in one sentence what you want to take over — the preview shows what matches.",
  "imp.step.groups": "Approve groups",
  "imp.step.groupsHint":
    "Approve or exclude whole groups — individual contributions can still be toggled one by one.",
  "imp.step.apply": "Take over & result",
  "imp.step.applyHint":
    "The approved contributions are taken over for review — the result shows honestly what happened.",
  "imp.step.done": "done",
  "imp.explore.ctaAgain": "Explore again",
  "imp.select.previewAgain": "Refresh preview",
  "imp.history.title": "Review history: open and imported contributions",
  "imp.history.count": "{{open}} open · {{total}} total",
  "imp.history.hint":
    "This is the history of earlier imports — contributions queued for review, accepted and rejected ones. You do not need this area for the current import.",
  // WP-UX-WOW-1 (Kopf's live UX findings U1-U9): polish for the first VIP2 impression.
  "ask.koQuestion": "What applies to: {{title}}?",
  "ask.confidentialPrefillHint":
    "Confidential content — review the question before sending. It was only prefilled, not sent automatically.",
  "ask.expect.neutral": "Try an example",
  "lib.confidenceNone": "Confidence not rated yet",
  "lib.confidenceNoneHint":
    "Confidence says how well-founded a piece of content is rated (0 to 100). 0 means: not rated yet — not that the content is wrong.",
  "con.emptyWhat":
    "A conflict arises when two contributions contradict each other — for example two different limit values for the same equipment.",
  "con.emptyHow":
    "Klarwerk detects such contradictions during review and comparison; a human then decides here which statement holds.",
  "con.emptyExamplesHint":
    "To try it out, load the example package “Contradicting statements” in the import area.",
  "con.emptyExamplesCta": "Open example packages",
  "role.gate.title": "This area belongs to a different role",
  "role.gate.body":
    "This area requires the {{owner}} role. Your current role is {{own}} — that is why this path is closed for you. Roles are assigned by the administration; there is nothing to switch on here.",
  "stage2.gate.title": "Advanced features (stage 2)",
  "stage2.gate.body":
    "This module belongs to the advanced features — called 'stage 2' in house: additional modules beyond the core flow. They are currently switched off, that is why this area is not visible yet.",
  "stage2.gate.enable": "Turn on stage 2 now",
  "stage2.gate.adminOnly": "An admin can turn on stage 2 via the switch in the sidebar.",
  "stage2.gate.back": "Back to start",
  "imp.cleanup.title": "Clean up test data",
  "imp.cleanup.desc":
    "Removes all entries from the import queue and moves all posts imported from Confluence or Jira to the trash. Posts created by hand, users and settings remain untouched.",
  "imp.cleanup.previewCta": "Load preview",
  "imp.cleanup.previewLoading": "Determining scope …",
  "imp.cleanup.previewResult": "This would remove {{n}} candidates and {{m}} imported posts.",
  "imp.cleanup.confirmHint":
    "The candidate list is emptied for good; the imported posts move to the trash and can be restored from there.",
  "imp.cleanup.confirmCta": "Clean up now",
  "imp.cleanup.cancel": "Cancel",
  "imp.cleanup.running": "Cleanup running …",
  "imp.cleanup.doneCandidates": "{{n}} candidates removed",
  "imp.cleanup.doneKos": "{{n}} imported posts moved to the trash",
  "imp.cleanup.doneSkipped": "{{n}} skipped (error while moving)",
  "imp.cleanup.drift":
    "The data changed since the preview — the preview was reloaded, please review and confirm again.",
  "imp.cleanup.auditFailed":
    "Note: the final audit log entry could not be written — the cleanup itself is complete.",
  "imp.cleanup.newSince": "{{n}} new candidates since the preview — left untouched.",
  "imp.cleanup.claimedKos":
    "{{n}} post(s) in an ongoing review action — excluded from the cleanup.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} candidate(s) with a pending action record — excluded from the cleanup until the record is written.",
  "exp.title": "Example packages",
  "exp.hint":
    "Curated small scenarios for testers — each package loads on its own and creates clearly marked example posts. The import cleanup does NOT remove them; they disappear via removing the demo data.",
  "exp.load": "Load",
  "exp.loading": "Loading …",
  "exp.result": "{{created}} created, {{skipped}} skipped (already present)",
  "exp.pkg.konflikte.title": "Contradicting statements",
  "exp.pkg.konflikte.desc":
    "Six posts in three pairs that contradict each other — ideal for trying conflict detection and validation.",
  "exp.pkg.bilder.title": "Knowledge with images",
  "exp.pkg.bilder.desc":
    "Three posts with images and descriptive image captions — ideal for the gallery and caption search.",
  "exp.pkg.qualitaet.title": "Mixed quality",
  "exp.pkg.qualitaet.desc":
    "Five posts ranging from good to too short to outdated — ideal for practicing review and quality assessment.",
  "dpk.title": "Demo packages",
  "dpk.hint":
    "Complete demonstration data sets: read what is inside, then load. Each package can be reset and removed on its own — other demo data and real posts stay untouched. Removing all demo data still takes the packages with it.",
  "dpk.fictional": "invented demo data",
  "dpk.scope": "{{items}} objects · {{areas}} · content in {{language}}",
  "dpk.stateNone": "not loaded yet",
  "dpk.stateLoaded": "{{loaded}} of {{items}} loaded",
  "dpk.stateEdited": "{{n}} of them edited",
  "dpk.load": "Load",
  "dpk.reset": "Reset",
  "dpk.remove": "Remove package",
  "dpk.removeConfirm": "Really remove",
  "dpk.cancel": "Cancel",
  "dpk.busy": "Working …",
  "dpk.resultLoad": "{{created}} created, {{skipped}} unchanged (already present)",
  "dpk.resultReset": "{{updated}} updated, {{skipped}} unchanged, {{created}} newly created",
  "dpk.resultRemove":
    "{{removed}} removed · {{conflicts}} conflicts and {{duplicates}} duplicates closed",
  "dpk.resultTrash": "{{n}} in the recycle bin — not created again",
  "dpk.resultFailures": "{{n}} not carried out",
  "dpk.stale": "State of the last fetch · refresh failed",
  "dpk.stateDuplicates": "{{n}} surplus copies",
  "dpk.resultDuplicates": "{{n}} surplus copies removed",
  "dpk.resetConfirm": "Really reset",
  "dpk.previewLoading": "Loading preview …",
  "dpk.previewError": "Preview unavailable — nothing is changed while it is missing. Try again.",
  "dpk.previewNone": "No object is currently assigned to this package.",
  "dpk.previewCounts": "Assigned: {{list}}",
  "dpk.previewIds": "Identifiers: {{ids}}",
  "dpk.artSeed": "baseline",
  "dpk.artUnregistered": "without a register entry",
  "dpk.previewRestore": "will be restored ({{n}}): {{ids}}",
  "dpk.previewRemove": "will be removed ({{n}}): {{ids}}",
  "dpk.previewMissing": "{{n}} missing baseline entries will be created",
  "dpk.resultAssigned": "{{n}} assigned objects removed",
  "imp.preview.sourceNewer": "source newer than import",
  "imp.select.empty": "No match for this narrowing.",
  "imp.select.aiUnavailable":
    "AI selection is currently unavailable — only your click filters apply.",
  "imp.select.aiConfidential":
    "Cloud AI excluded due to confidential content — the free-text sentence was not evaluated; only your click filters apply.",
  "imp.uploadTitle": "JSON re-import",
  "imp.uploadHint":
    "Pick a JSON file — the entries land as contributions in the review list (no silent bulk insert).",
  "imp.jsonOnlyReason":
    "Import currently accepts JSON only. For Office files (DOCX, PDF, PPTX) use “Capture knowledge → from file” — they are read for real there.",
  "imp.dropHint": "Drag and drop a JSON file here — or choose one below.",
  "imp.dropActive": "Drop the JSON file here …",
  "imp.dropReject": "“{{name}}” is not a JSON file — import currently accepts JSON only.",
  "imp.upload": "Choose JSON file",
  "imp.parsed": "{{n}} contributions queued for review.",
  "imp.parseError": "Invalid JSON file.",
  "imp.json.syntax":
    "The JSON syntax is invalid. Open the file in an editor, check brackets, quotation marks and commas, then select the corrected file again.",
  "imp.json.notArray":
    "The JSON is valid, but it is not a list. Put the entries in a list using [ and ], even for a single entry; use the template in the JSON box.",
  "imp.json.notObject":
    "Entry {{n}} is not an object. Replace it with an object containing the required fields as shown in the template in the JSON box, then select the file again.",
  "imp.json.fields":
    "Entry {{n}}: {{fields}} are missing or invalid. Open the file in an editor and add or correct these fields as text; allowed values for type: {{types}}. Use the template in the JSON box.",
  "imp.json.format":
    "A JSON list (array) of objects is expected. Required fields per entry, each as text: {{fields}}.",
  "imp.json.types": "Allowed values for type: {{types}}.",
  "imp.json.example": "Minimum template for one entry",
  "imp.json.exampleHint":
    "Select and copy the template, replace the example text in an editor and save it as a .json file. Then choose the file below.",
  "imp.json.exportPath":
    "Compatible file from your library: Library → “…” (More actions) → Export → JSON",
  "imp.queueTitle": "Import review list",
  "imp.queueEmpty": "No contributions to review.",
  // JOB 4293 (§ 9) — see the German block for the reasoning.
  "imp.stand.auffrischungLaeuft":
    "Last known state — the review list is being refreshed. “Accept” is available again as soon as it has been read afresh.",
  "imp.stand.auffrischungGescheitert":
    "Last known state — the refresh failed. “Accept” stays locked until this contribution has been read afresh.",
  "imp.stand.pausiert":
    "Last known state — not currently checkable without a network connection. “Accept” stays locked until this contribution has been read afresh.",
  "imp.stand.pausiertOhneStand":
    "Without a network connection the review list cannot be retrieved — this says nothing about open contributions.",
  "imp.stand.netzluecke":
    "State from before the network interruption — no new response has arrived since. “Accept” stays locked until this contribution has been read afresh.",
  "ext.pipeline.title": "Import pipeline & findings",
  "ext.pipeline.upload": "Upload",
  "ext.pipeline.extract": "Extract",
  "ext.pipeline.structure": "Structure",
  "ext.pipeline.review": "Review",
  "ext.pipeline.validate": "Validate",
  "ext.pipeline.release": "Release",
  "ext.pipeline.reuse": "Reuse",
  "ext.queue.total": "Total: {{n}}",
  "ext.queue.open": "Open: {{n}}",
  "ext.queue.accepted": "Accepted: {{n}}",
  "ext.queue.rejected": "Rejected: {{n}}",
  "ext.queue.infoRequested": "Info requested: {{n}}",
  "ext.queue.duplicates": "Duplicates: {{n}}",
  "ext.finding.duplicate": "Duplicate",
  "ext.finding.missingInfo": "Missing info",
  "ext.finding.infoRequested": "Info requested",
  "ext.finding.acceptedKo": "KO created",
  "ext.finding.inTrash": "in the trash, ID {{id}}",
  "ext.finding.reusedKo": "existing, ID {{id}} reused",
  "ext.finding.rejected": "Rejected",
  "ext.validity.title": "Validity & protection",
  "ext.validity.freshness": "Freshness",
  "ext.validity.outputEligible": "Output eligibility",
  "ext.validity.recommendation": "Recommendation",
  "ext.freshness.validiert": "validated",
  "ext.freshness.revalidierung-faellig": "revalidation due",
  "ext.freshness.offen": "open",
  "ext.freshness.konflikt": "conflict",
  "ext.freshness.unbekannt": "unknown",
  "ext.protection.ip": "IP sensitivity",
  "ext.protection.notRated": "not rated",
  "ext.outputEligible.yes": "yes",
  "ext.outputEligible.no": "no",
  "ext.recommendation.clarify-conflict": "Clarify conflict",
  "ext.recommendation.start-revalidation": "Start revalidation",
  "ext.recommendation.finish-validation": "Finish validation",
  "ext.recommendation.output-ready": "Ready for output",
  "ext.recommendation.unknown": "unknown",
  "imp.duplicate": "Duplicate",
  // JOB 3288 · IMPORT-VOLLTEXT: full text and source on the review card, before “Accept”.
  "imp.fullText.show": "Show full imported text",
  "imp.fullText.hide": "Hide full text",
  "imp.fullText.label": "Full imported content",
  "imp.fullText.missing":
    "No full text was transferred for this contribution — only the key statement is available here.",
  "imp.fullText.more": "Show more",
  "imp.fullText.less": "Show less",
  "imp.fullText.truncated": "Shown shortened — “Show more” reveals the whole text.",
  "imp.source.open": "Open source",
  "imp.source.newTab": "opens a new tab",
  "imp.source.space": "Space {{name}}",
  "imp.source.unlinkable":
    "The stored source address is not a safe web address — it is therefore not clickable.",
  "imp.source.none": "No source address is stored for this contribution.",
  "imp.note": "Note",
  "imp.accept": "Accept",
  "imp.reject": "Reject",
  "imp.info": "Request info",
  "imp.infoSend": "Send",
  "imp.notePlaceholder": "What information is missing?",
  "imp.reviewed": "Contribution updated.",
  "imp.status.neu": "Marked for review",
  "imp.status.in_bearbeitung": "In progress",
  "imp.status.angenommen": "Accepted",
  "imp.status.abgelehnt": "Rejected",
  "imp.status.info-angefragt": "Info requested",
  "imp.status.unknown": "Status unknown",
  "risk.kicker": "Risk & gaps",
  "risk.summary": "Cockpit overview",
  "risk.kpiOpenGaps": "Open gaps",
  "risk.kpiHigh": "High priority",
  "risk.kpiUnassigned": "Unassigned",
  "risk.kpiAssigned": "Assigned",
  "risk.kpiOpenConflicts": "Open conflicts",
  "risk.kpiClosedGaps": "Closed gaps",
  "risk.cockpit": "Risk cockpit by domain",
  "risk.cockpitEmpty": "No domain data.",
  "risk.level.kritisch": "critical",
  "risk.level.mittel": "medium",
  "risk.level.gut": "stable",
  "risk.koCount": "objects",
  "risk.validated": "validated",
  "risk.openKo": "open",
  "risk.singleSource": "Single source — concentration risk",
  "risk.singleSourceExplain":
    "All knowledge in this domain comes from a single person. If they leave (illness, resignation, retirement), the knowledge is gone — the biggest knowledge risk. Countermeasure: involve more people, have the knowledge second-checked (validated) and add sources.",
  "risk.bearer": "Carried by: {{names}}",
  "risk.viewObjects": "View this domain's objects",
  "risk.vsPlant.above": "Validated share above the plant average ({{avg}}%)",
  "risk.vsPlant.below": "Validated share below the plant average ({{avg}}%)",
  "risk.vsPlant.equal": "Validated share equal to the plant average ({{avg}}%)",
  "risk.staleByAssetChange_one": "{{count}} object to recheck after an asset change",
  "risk.staleByAssetChange_other": "{{count}} objects to recheck after an asset change",
  "risk.horizon.title": "My area · Secure knowledge before retirement",
  "risk.horizon.filterLabel": "Retirement horizon",
  "risk.horizon.filter": "next {{months}} months",
  "risk.horizon.notCountable":
    "What someone knows that is not yet in the system cannot be counted. Shown is what depends on the person — and what needs securing before the deadline.",
  "risk.horizon.noAreas": "No area has been maintained yet.",
  "risk.horizon.noOwnArea":
    "No area has been assigned to you yet. The assignment is maintained by the administration.",
  "risk.horizon.busFactorOne": "Bus factor 1",
  "risk.horizon.criticality": "Criticality: {{level}}",
  "risk.horizon.level.niedrig": "low",
  "risk.horizon.level.mittel": "medium",
  "risk.horizon.level.hoch": "high",
  "risk.horizon.noManager": "No responsible person entered yet",
  "risk.horizon.manager": "Responsible: {{name}}",
  "risk.horizon.noneInHorizon":
    "According to the maintained data, nobody in this area retires within the next {{months}} months.",
  "risk.horizon.bearer":
    "{{name}} · retiring within the next {{months}} months · knowledge to secure by {{due}}",
  "risk.horizon.todo.soleBearer":
    "Only source in this area — if it drops out, the knowledge is gone.",
  "risk.horizon.todo.openKos_one": "{{count}} own object not yet validated",
  "risk.horizon.todo.openKos_other": "{{count}} own objects not yet validated",
  "risk.horizon.todo.openGaps_one": "{{count}} open question assigned",
  "risk.horizon.todo.openGaps_other": "{{count}} open questions assigned",
  "risk.horizon.todo.koCount_one": "{{count}} object captured in this area",
  "risk.horizon.todo.koCount_other": "{{count}} objects captured in this area",
  "risk.pflege.title": "Maintain area profiles and retirement horizons",
  "risk.pflege.intro":
    "Per category: who is responsible for the area and the assessment of criticality, process proximity, repetition frequency and damage potential (empty = no input data). Per person: retirement within the next 24 or 36 months — only the horizon and the deadline are stored.",
  "risk.pflege.manager": "Responsible for {{category}}",
  "risk.pflege.noManager": "No responsible person",
  "risk.pflege.save": "Save",
  "risk.pflege.error": "Saving did not succeed.",
  "risk.pflege.retirementTitle": "Retirement horizons",
  "risk.pflege.retirement": "Retirement horizon of {{name}}",
  "risk.pflege.noRetirement": "No retirement entered",
  "risk.busLegendSingle": "red = single source (failure risk)",
  "risk.busLegendOk": "green = multiple sources",
  "risk.help.summary":
    "Overview in numbers: open gaps (questions without confirmed knowledge), high priority (urgent), unassigned/assigned (whether someone is working the gap), open conflicts (contradictory statements) and closed gaps (already answered). Red numbers indicate action is needed.",
  "risk.help.cockpit":
    "Risk per domain (category): CRITICAL/MEDIUM/STABLE sums up how well the domain is secured. Objects = how much knowledge; validated % = how much of it is checked; open = still unchecked; experts = how many people carry the domain. One expert + little validated = high risk.",
  "risk.help.busfactor":
    "How much does a domain depend on individuals? A red bar means: the knowledge comes from only ONE source — if it fails, it is lost. Green = multiple sources, so more robust. The bar also shows the domain's amount of knowledge.",
  "risk.help.gaps":
    "Open knowledge gaps are questions with no confirmed answer (yet). Prioritize them, assign them to someone, or capture reviewed experience yourself. For privacy, do not put sensitive details into the question.",
  "health.title": "Knowledge Health",
  "health.band.gut": "good",
  "health.band.mittel": "medium",
  "health.band.kritisch": "critical",
  "health.explain.gut": "High validation level, little stale knowledge and low concentration risk.",
  "health.explain.mittel":
    "Solid base, but open gaps/conflicts or revalidation needs are holding it back.",
  "health.explain.kritisch":
    "Low validation and/or much stale knowledge, open conflicts or single-source risks.",
  "health.factor.validatedRatio": "Validation rate",
  "health.factor.staleRatio": "Revalidation due (stale)",
  "health.factor.singleSourceShare": "Single-source share",
  "health.factor.openGaps": "Open knowledge gaps",
  "health.factor.openConflicts": "Open conflicts",
  "health.band.unproven": "rating not evidenced",
  "health.unknown": "unknown",
  "health.unknownExplain":
    "Live signals for this value are currently missing (knowledge objects, gaps, conflicts, revalidations or bus factor are not loaded or not reachable). That is why no number is shown here — nothing is estimated.",
  "health.range.explain":
    "{{worst}} out of 100 in the worst case, {{best}} in the best. As long as it is not evidenced that conflicts were searched for completely, the worse value applies — which is why no band is shown here.",
  "health.conflictUnproven.title":
    "The score applies the full conflict penalty: {{worst}} instead of {{best}} out of 100.",
  "health.conflictUnproven.detection-incomplete":
    "Conflict and duplicate detection has not run to completion across the corpus. It is therefore not ruled out that more conflicts exist than were found — and a penalty of zero would be an assumption about something unknown.",
  "health.conflictUnproven.detection-unknown":
    "Nothing is established about the reach of conflict and duplicate detection. As long as complete checking is not evidenced, the number of conflicts found says nothing about the corpus.",
  "health.conflictUnproven.known":
    "{{count}} open conflicts are known ({{penalty}} of at most {{max}} penalty points). That penalty is certain; the remainder up to the maximum is the uncertainty.",
  "risk.busfactor": "Single-source risk (bus factor)",
  "risk.busEmpty": "No risk data.",
  "risk.experts": "experts",
  "risk.expertsCount_one": "{{count}} expert",
  "risk.expertsCount_other": "{{count}} experts",
  // Consultant-System (expert matching): understated tone, no hero wording, no numbers/ranking.
  "expertise.title": "Who to involve",
  "expertise.intro":
    "These people have already contributed to a topic. You can ask them for a quick take — no ranking, just who might help.",
  "expertise.help":
    "Derived from existing knowledge objects (who contributed to a topic). Alphabetical order, no scoring — a hint on who you could reach out to.",
  "expertise.invite": "You have experience with {{topic}} — could you give a quick take?",
  "expertise.thanks": "Thanks, that helps the team.",
  "risk.gaps": "Open knowledge gaps",
  "risk.gapsEmpty": "No open gaps.",
  "risk.gapStatus.offen": "open",
  "risk.gapStatus.geschlossen": "closed",
  "risk.priorityLabel": "Priority",
  "risk.priority.hoch": "high",
  "risk.priority.mittel": "medium",
  "risk.priority.niedrig": "low",
  "risk.close": "Close",
  "risk.closeWithTitle": "Close with the knowledge object that answers this gap",
  "risk.closeFailed": "Not closed — the knowledge object is missing or in the trash.",
  "risk.assign": "Expert …",
  "risk.delete": "Delete",
  "risk.gapNextLabel": "Next step",
  "risk.gapNext.prioritize": "Assess and set the urgency.",
  "risk.gapNext.assign": "Assign to an expert.",
  "risk.gapNext.capture": "Capture knowledge to close the gap.",
  "risk.gapNext.done": "Closed — nothing pending.",
  "risk.gapCapture": "Capture knowledge",
  "risk.gapRedacted": "Confidential gap (question hidden)",
  "lcy.kicker": "Lifecycle",
  "lcy.banner": "„Still correct?“ — review coupled objects after an asset change.",
  "lcy.empty": "Nothing to re-validate.",
  "lcy.stillValid": "Still valid → new version",
  "lcy.assetTitle": "Report asset change",
  "lcy.assetToggle": "Asset changed …",
  "lcy.assetHint":
    "Enter the changed asset/process reference — coupled knowledge objects are flagged for review.",
  "lcy.assetPlaceholder": "Asset/process reference (e.g. press-P2)",
  "lcy.assetTrigger": "Trigger revalidation",
  "lcy.assetMarked": "{{n}} object(s) flagged for review for „{{asset}}“.",
  "lcy.pendingTitle": "Pending re-validation",
  "lcy.revalAsset": "Asset",
  "lcy.revalNextLabel": "Next step",
  "lcy.revalNext.review": "Check whether still valid after the change — then confirm as reviewed.",
  "lcy.revalNext.validate": "Object is not released — validate it first.",
  "lcy.revalCta.review": "Go to review",
  "lcy.revalCta.validate": "Go to validation",
  "lcy.revalNext.openKo": "Open the object — details are not available right now.",
  "lcy.revalMissing": "Object details not in the loaded set.",
  "lcy.revalSaved": "Re-validation recorded.",
  "lcy.nextViewKo": "View object",
  "lcy.nextUse": "Use knowledge (ask)",
  "lcy.pathTitle": "Learning path · {{role}}",
  "lcy.pathEmpty": "No learning path defined for your role yet.",
  "lcy.stepComplete": "Mark as done",
  "lcy.stepDone": "Done",
  "ana.kicker": "Analytics & audit",
  "ana.exec.title": "Executive view",
  "ana.exec.validated": "Validated knowledge",
  "ana.exec.validatedHint": "reviewed, confirmed objects",
  "ana.exec.openReviews": "Open reviews",
  "ana.exec.openReviewsHint": "awaiting validation",
  "ana.exec.busFactor": "Single-source risk",
  "ana.exec.busFactorHint": "categories with a single source",
  "ana.exec.rescued": "Rescued gaps",
  "ana.exec.rescuedHint": "closed knowledge gaps",
  "ana.help.exec":
    "Four core metrics from live data: validated knowledge, open reviews, bus-factor risk and rescued gaps. A calm overview for decision-makers — the more that is validated and the lower the risk, the healthier the knowledge base.",
  "ana.help.health":
    "The health score (0–100) combines validation level, freshness and source breadth. The band (e.g. good or critical) shows the state at a glance; below it you see which factors raise or lower the value.",
  "ana.help.impact":
    "Impact shows what the system actually delivers: total validated objects, questions asked, questions answered without a gap, and the resulting answer rate. The weekly trend reveals whether validated knowledge is growing.",
  "ana.help.audit":
    "The audit log records every relevant action — who (actor), what (action) and on what target. Entries are only appended and hash-chained; a later deviation is detectable by recomputation. Use the filters to narrow down to a person, an action type or an object.",
  "ana.total": "Total",
  "ana.categories": "Categories",
  "ana.byType": "Distribution by knowledge type",
  "ana.audit": "Audit log (hash-chained)",
  "ana.auditEmpty": "No entries.",
  "ana.avgTrust": "Avg trust",
  "ana.validationRate": "Validation rate",
  "ana.openTasks": "Open tasks",
  "ana.doneTasks": "Done",
  "ana.impact": "Impact",
  "ana.impactValidated": "Validated total",
  "ana.impactAsk": "Questions total",
  "ana.impactAnswered": "Answered without gap",
  "ana.impactRate": "Answer rate",
  "ana.weekly": "Validated per week",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Action",
  "ana.filterTarget": "Filter target …",
  "ana.filterAll": "all",
  "ana.auditCount": "{{shown}} of {{total}}",
  "ana.auditNoMatch": "No matches for this filter.",
  "adm.kicker": "User management",
  "adm.empty": "No users.",
  "adm.approve": "Approve",
  "adm.remove": "Delete",
  "adm.createTitle": "Create user",
  "adm.name": "Name",
  "adm.email": "Email",
  "adm.password": "Password",
  "adm.role": "Role",
  "adm.create": "Create",
  "adm.created": "User created.",
  "adm.createInvalid": "Please still add:",
  "adm.createHint": "Required: name, valid email and password (min. 8 characters).",
  "adm.field.name": "name",
  "adm.field.email": "valid email",
  "adm.field.password": "password (min. 8 characters)",
  "adm.reset": "Reset password",
  "adm.newPassword": "New password",
  "adm.newPasswordRepeat": "Repeat password",
  "adm.passwordMismatch": "The passwords do not match.",
  "adm.resetConfirm": "Reset",
  "adm.resetCancel": "Cancel",
  "adm.resetDone": "Password reset; all sessions ended.",
  "adm.correct": "Correct account details",
  "adm.correctSave": "Save account details",
  "adm.correctDone": "Account details corrected.",
  "adm.gastfrist.titel": "Access valid until",
  "adm.gastfrist.unbefristet": "No end date — this access does not expire on its own.",
  "adm.gastfrist.gueltigBis": "Valid until {{datum}}.",
  "adm.gastfrist.abgelaufen": "Expired on {{datum}} — this access is no longer valid.",
  "adm.gastfrist.unlesbar": "The stored expiry value is unreadable; it does not end the access.",
  "adm.gastfrist.hinweis":
    "The time limit applies in addition to approval — both conditions must be met.",
  "adm.gastfrist.setzen": "Set time limit",
  "adm.gastfrist.verlaengern": "Change or extend time limit",
  "adm.gastfrist.beenden": "End time limit",
  "adm.gastfrist.datum": "Access ends at the end of this day",
  "adm.gastfrist.speichern": "Save time limit",
  "adm.gastfrist.abbrechen": "Cancel",
  "adm.gastfrist.gespeichert": "Time limit saved.",
  "adm.gastfrist.beendet": "Time limit ended; the access has no end date again.",
  "adm.gastfrist.datumFehlt": "Please choose a day first.",
  "adm.gastfrist.fehlerHilfe": "Nothing was changed. Choose a day and save again.",
  "adm.gastfrist.fehlerOffen":
    "Whether the time limit was saved is not confirmed. The state above is being fetched again — read it before you save once more.",
  "adm.gastfrist.anlageHinweis":
    "Without a day, the access has no end. With a day, the access is created with that limit — or, if something goes wrong, not at all.",
  "adm.gastfrist.anlageFehlerHilfe":
    "No account was created. Please correct the details and create it again.",
  "adm.gastfrist.anlageFehlerOffen":
    "Whether the account was created is not confirmed. Check the account list before you create it again.",
  "adm.seedTitle": "Load demo data",
  "adm.seedHint":
    "Loads a small, real demo set (KOs, validation, gap, conflict, duplicate, attachment) — also alongside existing data. Your real content stays untouched and is never overwritten. Removable on demand via “Remove demo data”. (Conflict/duplicate findings appear with an active AI reasoner.)",
  "adm.seedButton": "Load demo data",
  "adm.seedDone": "Demo data loaded: {{kos}} knowledge objects, {{users}} users.",
  "adm.seedSkipped": "Skipped: instance is not empty (content present).",
  "empty.cta.capture": "Capture knowledge",
  "empty.cta.import": "Import",
  "empty.cta.admin": "Demo data (admin)",
  "empty.cta.library": "Go to library",
  "empty.cta.validation": "Go to validation",
  "empty.cta.tasks": "Go to my tasks",
  "story.rescue.title": "Klarwerk secures hands-on experience before it's lost.",
  "story.honest":
    "Nothing is validated automatically — knowledge only counts as secured after the team reviews it.",
  "story.surface.start.lead":
    "Nothing open yet — not a dead end, but the start. Kick off the cycle and capture experience knowledge that would otherwise fade over time.",
  "story.surface.tasks.lead":
    "Nothing to do right now. As soon as knowledge needs review or rework it shows up here — or capture the next contribution yourself.",
  "story.surface.library.lead":
    "No knowledge to look up yet. Capture the first contribution — after review it becomes usable here, source-bound.",
  "story.surface.validation.lead":
    "Nothing to review. Captured knowledge appears here for team review before it counts as secured and can be used.",
  "adm.auditTitle": "Recent user/auth activity (audit)",
  "adm.auditEmpty": "No user audit entries.",
  "prof.kicker": "Account",
  "prof.language": "Language",
  "prof.passwordTitle": "Change password",
  "prof.oldPassword": "Current password",
  "prof.newPassword": "New password",
  "prof.passwordSubmit": "Change password",
  "prof.passwordChanged":
    "Password changed. For security you've been signed out everywhere — please sign in again.",
  "prof.correctTitle": "Correct account details",
  "prof.correctPassword": "Current password (only for a new email)",
  "prof.correctSubmit": "Save account details",
  "prof.correctSaved": "Account details saved.",
  "prof.correctUnchanged": "Nothing changed.",
  "prof.correctSso": "Confirm with SSO instead",
  "prof.correctSaml": "Confirm with SAML company sign-in instead",
  "prof.correctSsoConfirmed": "Identity confirmed via SSO — now save your account details.",
  "prof.correctSsoKontoGewechselt":
    "A different account signed in during the SSO confirmation. The previous account's draft was discarded; the details shown belong to the account that is now signed in.",
  "help.kicker": "Help",
  "help.open": "Open help",
  "help.openCenter": "Open in help center",
  "help.search": "Search help …",
  "help.intro":
    "A short starter guide to the most important Klarwerk flows. Search by keyword or jump straight into the relevant area.",
  "help.noResults": "No help found for this keyword.",
  "help.openRoute": "Open area",
  "help.support.title": "Support for this installation",
  "help.support.configured": "The operator of this installation has set up this support channel:",
  "help.support.linkDefault": "Open support page",
  "help.support.mailDefault": "Email support",
  "help.support.newTab": "new tab",
  "help.support.notConfigured":
    "No support channel has been set up for this installation yet. Please contact the administrators of your instance with questions.",
  "help.support.invalid":
    "A support channel is configured for this installation, but it is invalid and is therefore not shown. Please let the administrators of your instance know.",
  "help.support.loadError":
    "The support channel could not be loaded right now. The help on this page still works.",
  "help.support.loading": "Loading support channel …",
  // Klara v1 (Pedi 05.07.): context-sensitive help — panel copy + page explanations.
  "klara.title": "Klara",
  "klara.subtitle": "Your help in KLARWERK",
  "klara.open": "Open Klara — help for this page",
  "klara.intro":
    "I explain pages, fields and terms. My answers come from the help library — if something is missing there, I will not make it up.",
  "klara.pageLabel": "You are here",
  "klara.fieldLabel": "Active element",
  "klara.fieldHint":
    "Focus a field or an area with a ?-help — then I explain it here automatically.",
  "klara.aiSearch": "Search with AI support",
  "klara.aiBusy": "The AI is reading the matching help entries …",
  "klara.aiAnswerTitle": "AI answer from the help",
  "klara.aiDisclaimer": "AI-generated — not fully verified",
  "klara.helpAnswerTitle": "Answer from the help",
  "klara.ohneModell": "Rule-based, no AI model",
  "klara.aiGoto": "Open area: {{target}}",
  "klara.aiSources": "Based on",
  "klara.aiEmpty":
    "The AI found no reliable answer in the matching help entries — an honest help gap. Rephrase the question or check the help page.",
  "klara.speak": "Read aloud",
  "klara.speakStop": "Stop reading",
  "klara.inspect": "Explain element",
  "klara.inspectHint":
    "Point mode active: click any element (button, metric, heading) — the action itself is NOT triggered. Esc exits the mode.",
  "klara.inspectFor": "Explanation for: {{label}}",
  "klara.selectionExplain": "Explain selection",
  "klara.selectionEmpty":
    "Select a term on the page first — then I will look up the matching explanation.",
  "klara.searchPlaceholder": "Search help … e.g. validation, bus factor, draft",
  "klara.resultsFor": "Results for: {{q}}",
  "klara.noResults":
    "I have no entry on this yet — an honest help gap. The library is growing; the help page has the guided introductions.",
  "klara.moreHelp": "Open help page",
  "klara.page.start":
    "Your overview: what was freshly secured, what helped today and what is waiting for you. Jump into any area from here.",
  "klara.page.tasks":
    "Open tasks: due reviews, gaps and due items — each with a direct jump to the work.",
  "klara.page.capture":
    "Here you secure experience knowledge: tell it, dictate it, in an interview or from a file. The AI only structures — you review and submit.",
  "klara.page.ask":
    "Ask a question. The answer is source-bound and shows you what it rests on and what state those sources are in — if there is no basis, an honest knowledge gap is created.",
  "klara.page.library":
    "All knowledge objects with status, trust and filters. Every detail is one click away.",
  "klara.page.external":
    "External knowledge (e.g. web sources) — always level 2: never peer-validated and clearly separated from the reviewed stock.",
  "klara.page.validation":
    "The review board: you rate submitted knowledge. Only with enough green approvals (and no red ones) does an object count as validated.",
  "klara.page.conflicts":
    "Contradictions between knowledge objects: inspect, get a second opinion, resolve — so the library stays unambiguous.",
  "klara.page.duplicates": "Possible duplicates: review and merge so knowledge does not fragment.",
  "klara.page.risk":
    "Where is knowledge thin or carried by a single person? Open gaps, bus factor and domain risk — with links to the affected objects.",
  "klara.page.lifecycle":
    "Knowledge ages: here you see due re-validations and learning paths, so reviewed stays reviewed.",
  "klara.page.analytics":
    "Metrics from real data plus the hash-chained audit log — who did what and when.",
  "klara.page.admin":
    "Accounts, AI assignment, data and security in one place. Visible to admins only.",
  "klara.page.help":
    "Guided introductions, topics and search. I am the fast lane — this page is where the depth lives.",
  "klara.page.profile": "Your account: name, language, sign out.",
  "klara.page.koDetail":
    "The detail page of a knowledge object: content, versions, sources, attachments, review history and role-based actions.",
  // JOB 1151 (KA3) — see the German entry for the finding and the two-dictionary pattern.
  "klara.offer.label": "Klara's suggestions",
  "klara.offer.lead": "There is already something on this:",
  "klara.offer.open": "View",
  // JOB 1153 (KA6 stage 1) — see the German block for the reasoning and the two-dictionary pattern.
  "klara.write.title": "Write on request",
  "klara.write.hint":
    "Klara drafts a suggestion. It lands in the answer field above and only goes into the document when you click.",
  "klara.write.create": "Draft",
  "klara.write.complete": "Complete",
  "klara.write.rephrase": "Rephrase",
  "klara.write.busy": "Klara is drafting a suggestion ...",
  "klara.write.ready":
    "The suggestion is in the answer field — nothing was written into the document.",
  "klara.write.empty": "Select text in the document first, or type above what it should be about.",
  "klara.write.noBasis": "No suggestion: there is no reliable basis for this. Nothing is invented.",
  "klara.write.insertCta": "Insert suggestion into Word",
  "klara.write.insertOk": "Suggestion inserted — with its provenance line.",
  "klara.write.provenance":
    "AI-phrased — not quoted KLARWERK knowledge. Please review professionally before use.",
  "klara.write.blockedNotMigrated":
    "Drafting is switched off here: the external path is not enabled yet. That is an operational decision — there is nothing you can change about it.",
  "klara.write.blockedConsentMissing":
    "Drafting is blocked because your consent for the external path is missing. You can give it in the consent card above.",
  "klara.write.blockedOther":
    "Drafting is blocked for this session. The server gives this reason: {{grund}}",
  "klara.write.blockedUnknown":
    "Whether drafting is allowed is not known yet — the session status is being retrieved. Until then no request is offered.",
  // Section explanations (consultant delivery 05.07., interim EN — refined in delivery 3).
  "shelp.adm.seedTitle":
    "Here you load ready-made sample data to try KLARWERK safely. This only works while the instance is still empty — so real data and samples never mix. All sample data is marked as such and can later be removed completely with one click.",
  "shelp.adm.createTitle":
    "In this section you create a new user account and assign a role. Viewers read, experts capture knowledge, controllers review it, and admins manage everything. The role decides which buttons the person will see. Every account change is recorded in the audit log.",
  "shelp.adm.auditTitle":
    "This log shows recent sign-ins and user actions. Every line is hash-chained to the previous one: if something is changed or removed afterwards, the hash no longer matches. With the verify button you can have the chain recomputed at any time; the result honestly tells you whether a deviation was found — and if so, at which entry.",
  "shelp.ana.byType":
    "The bars show how your knowledge is spread across the five knowledge types — from gut feeling to proven practices to negative knowledge, meaning what must not be done. If one type is almost missing, that is a hint: little is being captured there so far. Use the picture to ask targeted questions, not to rate people.",
  "shelp.ana.weekly":
    "This overview counts how many knowledge objects passed review in each week. It shows the pace at which secured knowledge is created — not how hard individuals worked. If the curve flattens, reviews are usually piling up; a look at the review board shows where it sticks.",
  "shelp.ask.steps":
    "Listed here are the knowledge objects that were consulted from the corpus for your question — with an excerpt from the passage found. It is NOT a derivation: KLARWERK does not record which sentence of the answer came from which source. The list tells you what was searched; to verify, open the named source.",
  "shelp.ask.sources":
    "Every answer in KLARWERK relies exclusively on your own knowledge objects — and exactly those are listed here. The ones listed first carried the answer; the rest were consulted but not used. Tap a source to open the full object with evidence and review status. If nothing is listed, there is no matching knowledge for your question, and KLARWERK says so honestly instead of inventing something.",
  "shelp.capture.resumeTitle":
    "Your saved drafts live here — everything you started but have not submitted yet. Nothing is lost, and reviewers see none of it until you submit. Tap a draft to continue, or discard it when it is no longer needed.",
  "shelp.ext.title":
    "Here you can search for external sources and attach them to your knowledge, for example a journal article. Important: external sources are level-two material — they count as unreviewed and never replace the review by your colleagues. Whether this search is available is decided by administration via its own release stage.",
  "shelp.extpage.resultsTitle":
    "This list shows the results of the external search. Everything here comes from outside and is unreviewed — that is why it is clearly marked as external and never taken over automatically. You decide whether to attach a result as a level-two source. Secured knowledge only emerges once people review it.",
  "shelp.ko.statement":
    "This is the core of the knowledge object: a single, clear statement about what holds. Everything else on this page — conditions, measures, evidence — hangs off this sentence. Read the statement first, then check below when it applies and what it rests on.",
  "shelp.ko.conditions":
    "Conditions tell you when the statement applies — and thus also when it does not. An example: a rule for winter operation is no help in summer. Before applying, always check whether your situation matches the stated conditions.",
  "shelp.ko.measures":
    "Measures describe what to do in practice when the statement applies — step by step. They are kept deliberately brief so they stay usable in daily work. If a step is missing or unclear, leave a comment; that is how the knowledge improves over time.",
  "shelp.ko.provenance":
    "Here you see where this knowledge comes from: who captured it, when it was created and whether it was ever transferred. Provenance is no side issue in KLARWERK — traceable origin is part of trust. If you have questions, this tells you whom to ask.",
  "shelp.ko.lineageTitle":
    "This section shows the kinship of this knowledge: what it emerged from and which other objects it is connected to. That way you can tell whether it is part of a larger topic. Use the links to move onward instead of reading isolated pieces.",
  "shelp.nb.title":
    "The knowledge network shows the neighbourhood of the article you are reading: the article sits in the middle, around it what belongs to it via shared tags — and every connection states why. Clicking a neighbour makes it the new centre; “Open article” takes you to it. Tags that almost every article carries do not count as kinship — when that happens, it is stated honestly.",
  "shelp.ko.history":
    "Every content change creates a new version, and here you see the trail: who changed what, when, and with which note. Older states are kept; nothing is silently overwritten. That way you can retrace how the knowledge evolved.",
  "shelp.ko.evidenceTitle":
    "Evidence is the proof behind the statement: attached sources, documents and records, each assigned to the version they belong to. The better the evidence, the more reliable the knowledge — in KLARWERK trust comes from proof, not from claims. An object without evidence is not automatically wrong, but it deserves a more critical look.",
  "shelp.ko.snapshotsTitle":
    "A snapshot is the complete, frozen state of an earlier version. Here you can read exactly what the object looked like at a given moment. Snapshots are read-only — nobody can change them, and precisely that makes them valuable as proof.",
  "shelp.ko.comments":
    "Here colleagues discuss this object: questions, additions, objections. A comment does not change the knowledge itself — it is a conversation on the side that often leads to a better next version. If you know something that is missing here, write it down.",
  "shelp.ko.attachments":
    "Documents and images that belong to this knowledge live here — such as a photo of the machine or a manual. Attachments are illustration and evidence, not reviewed statements. Uploads are subject to size limits set by your administration.",
  "shelp.lcy.assetTitle":
    "Some knowledge is tied to a specific machine or facility. When something changes there — a rebuild, a replacement, a new setting — you can report it here. The affected knowledge objects are then sent back for review, so nobody works with an outdated state.",
  "shelp.lcy.pendingTitle":
    "Knowledge ages. This list holds objects whose review needs a refresh — for example because they have not been touched for a long time or because their surroundings changed. Re-reviewed knowledge stays trustworthy; refreshes left undone are a silent risk.",
  "shelp.lcy.pathTitle":
    "A learning path is a sensible reading order through the existing knowledge, tailored to a role. New colleagues work through it step by step and tick off what they have read. That turns individual knowledge objects into a guided introduction.",
  "shelp.out.kindTitle":
    "Here you choose which kind of document should be created from your secured knowledge — for example a work instruction, a checklist or a training document. The type determines the structure and tone of the result. Nothing is generated until you trigger it.",
  "shelp.out.sourcesTitle":
    "Only reviewed knowledge objects qualify for a document, and exactly those are what you select here. What is not validated is deliberately not offered — a generated document should rest on secured knowledge only. Pick the objects that belong together.",
  "shelp.out.composeTitle":
    "Here you arrange the selected knowledge objects in the order they should appear in the document. The order carries the logic of the result — from overview to detail or along a workflow. Move the entries until the thread is right.",
  "shelp.out.previewTitle":
    "The preview shows the document as it would be generated from your building blocks, in Markdown text format. Check calmly whether content and order fit before you download or copy the result. A PDF export does not exist at present.",
  "shelp.out.provenanceTitle":
    "Every generated document carries the record of which knowledge objects it was built from. This section keeps that origin, so every statement in the document stays traceable to its source. It is the same principle as everywhere in KLARWERK: only the proof makes a statement reliable.",
  "shelp.imp.uploadTitle":
    "Here you re-import an export created earlier in JSON format. Entries are not taken over blindly: they first land as candidates for inspection, so nothing slips into the stock unreviewed. Check the candidate list before accepting anything — also to avoid duplicates.",
  "shelp.ext.pipeline.title":
    "This area shows what happened while external content was read in: what was recognized, what stood out and what still awaits a decision. The pipeline takes over nothing on its own — it prepares, people decide. Best work through the findings from top to bottom.",
  "shelp.imp.queueTitle":
    "This queue holds imported sources that still need a human judgement: accept, rework or discard. Nothing from here becomes part of the knowledge stock without your decision. This is where raw material is separated from secured knowledge.",
  "shelp.mgmt.jumpTitle":
    "This bar is the table of contents of the management view. Tapping an entry jumps straight to the matching section below. It changes nothing in the data — it only helps you navigate quickly.",
  "shelp.mgmt.overview":
    "This overview condenses the current state of your knowledge stock into a few key figures — such as how much knowledge exists, is reviewed or in progress. It is a snapshot for orientation, not a report card. For details, open the sections below.",
  "shelp.mgmt.capital":
    "This value condenses the state of your knowledge stock into a single number — considering, for example, how much knowledge is reviewed and how well it is evidenced. Read it as a rough orientation and watch its development over time. A single number never replaces a look at the details.",
  "shelp.mgmt.valuation":
    "This section makes the value of your knowledge more tangible: an assessment of which holdings contribute most to safety and the ability to act. The numbers are orientation values from the stock, not an audited balance sheet. Use them to discuss priorities, not as bookkeeping.",
  "shelp.mgmt.statement":
    "The knowledge statement is a summarizing report on your knowledge stock, meant for leadership and boards. In short form it answers: what do we have, how reliable is it, and where are the gaps. The report draws on the real stock — what it cannot prove, it does not claim.",
  "shelp.mgmt.maturity":
    "The maturity journey assesses how far your organization has come in handling knowledge — from the first secured entries to a practiced cycle of capturing, reviewing and maintaining. It shows the next sensible stage, not a grade. Maturity grows with use, not at the push of a button.",
  "shelp.mgmt.house":
    "The knowledge house is a picture of your topic landscape: rooms stand for knowledge areas, and you see at a glance which are well filled and which are almost empty. Empty rooms are no disgrace but an invitation — that is where the next capture pays off. Tap an area to look inside.",
  "shelp.mgmt.recommendations":
    "Here KLARWERK suggests next steps that follow from your stock — for example reviews left undone or a knowledge area fed by only one source. They are suggestions, not orders: you decide what is due. Each suggestion takes you straight to the right place.",
  "shelp.mgmt.priorities":
    "This list ranks knowledge topics by how urgently they need attention — assessed over nine aspects such as risk, age and dependence on single knowledge sources. What should come first is at the top. The order is a recommendation as a basis for discussion, not an automatic decision.",
  "shelp.mgmt.pilot":
    "This report bundles what happened in the first thirty, sixty and ninety days of a pilot and what comes next. It makes progress visible for everyone involved — honestly, with achieved and open points. Meant as a shared basis for the conversation with leadership.",
  "shelp.mrun.title":
    "This list logs the AI's recent runs: which task ran, which model answered, how long it took and whether a fallback was needed. The content of your texts is deliberately not stored here — only technical facts. That keeps traceable what the AI did and when.",
  "shelp.rcfg.title":
    "Here you see which AI is configured for which task — the cloud AI, your On-Premise Enterprise AI or the rule-based mode without any model. The assignment can be changed per task, and the app honestly shows what is currently in effect. AI keys always stay on the server; none ever reaches the browser.",
  "shelp.evx.title":
    "The evidence index is the quality view of your proof situation: it shows which knowledge objects are well evidenced and where records are missing. It helps you find exactly the entries that need evidence before their next use. Well-evidenced knowledge is the backbone of every reliable answer.",
  "shelp.prov.title":
    "This index checks the provenance side of quality: is it traceable for every knowledge object where it came from and how it was created? Anomalies are listed first so you see them right away. Complete provenance is the basis for placing knowledge in context later.",
  "shelp.readiness.title":
    "This section assesses how ready your knowledge system is as a whole — from the data base through the review processes to the AI connection. The traffic lights show where things still stick and what makes sense next. It is a positioning, not an acceptance test.",
  "shelp.kos.hintsTitle":
    "Here quality assurance collects concrete hints from the stock: things that stand out and deserve a look — such as thinly evidenced objects or orphaned topics. Every hint names the location, so you can jump right in and fix the cause.",
  "shelp.evFresh.title":
    "Evidence ages just like knowledge. This view shows how fresh the records behind your knowledge objects are and where old evidence needs a refresh. That way you spot entries that are formally evidenced but possibly outdated in substance.",
  // SCRUM-305: compact pilot checklist for the first real user run (Stage-1, honest).
  // JOB 4022: see the German block — the old promise „each point opens the matching area" was
  // wrong for four of five steps (they need a higher role), and the wording was system language
  // („Stage-1", „review/decision", „peers"). Same promises, everyday words.
  "pilot.access.title": "Your first working path: how to start",
  "pilot.access.subtitle":
    "The seven steps of a first run. Each step either opens its area or names the role it requires.",
  "pilot.access.summary":
    "Your role ({{rolle}}) can walk {{offen}} of {{gesamt}} steps. The others stay listed so you know the whole path.",
  "pilot.access.locked": "Requires the {{rolle}} role",
  "pilot.access.roleUnknown":
    "Your role is not settled yet. Which steps are open to you appears here as soon as it is known.",
  "pilot.check.start": "The entry page shows what is due — every working path starts here.",
  "pilot.check.library":
    "The library shows what is already there: with source, state and history — reading is open to every role.",
  "pilot.check.capture": "What you capture is saved as open: it has not been checked yet.",
  "pilot.check.validation":
    "When checking, colleagues rate your entry until it counts as secured — nothing is approved automatically.",
  "pilot.check.use":
    "Ask and library show the source behind every answer and its state — an answer is only as reliable as its source.",
  "pilot.check.gap":
    "If the basis is missing, the answer says so honestly and leads to capturing it — nothing is invented.",
  "pilot.check.maintain":
    "“Keep current” means: entries whose check is due are looked at again — nothing stays valid forever automatically.",
  // SCRUM-306 / JOB 4067: the visible next step after loading demo data (no auto-redirect). The
  // labels name what the surface itself shows — `nav.start` and the card's current name on `/hilfe`
  // (`pilot.access.title`). The honest sentence about demo data stays word for word.
  "pilot.next.title": "Next step",
  "pilot.next.hint":
    "Demo data are examples, not production proof. Now look at Home or open your first working path in the help.",
  "pilot.next.start": "Open Home",
  "pilot.next.checklist": "Open “Your first working path: how to start”",
  "pilot.next.ask": "Open example question",
  // SCRUM-307 / JOB 4067: where to carry on when something gets stuck — into the EXISTING areas (no
  // backend, no storage, no Jira/task automation). The entry about operating the software
  // deliberately has no product link. The three promises stay: nothing is stored · no process is
  // triggered · plain notes about operating the software belong outside the product.
  "pilot.obs.title": "If something gets stuck: here is where it belongs",
  "pilot.obs.subtitle":
    "Five situations from everyday work — next to each one is the area where you carry on. Nothing is stored, no process is triggered; plain notes about operating the software belong outside the product.",
  "pilot.obs.mapLabel": "Belongs in",
  "pilot.obs.missing.label": "It is missing entirely: there is no entry on the question yet.",
  "pilot.obs.missing.map":
    "Risk & Gaps — note what is missing and how urgent it is; then capture it.",
  "pilot.obs.unverified.label": "An entry is unfinished or has not been checked yet.",
  "pilot.obs.unverified.map": "Validation — colleagues rate it there until it counts as secured.",
  "pilot.obs.outdated.label": "An entry looks outdated or no longer applies.",
  "pilot.obs.outdated.map": "Lifecycle — it is looked at again there (“keep current”).",
  "pilot.obs.source.label":
    "With an entry it is unclear where it comes from or how reliable it is.",
  "pilot.obs.source.map":
    "Library — source, date, version and status are shown there for every entry.",
  "pilot.obs.uxnote.label": "It is about operating the software itself: wording, sequence, path.",
  "pilot.obs.uxnote.map":
    "No area — note that outside; it is not stored in the product and triggers no process.",
  "pilot.obs.openFlow": "Open area",
  // JOB 4071 (ALTKAPITEL-ANWENDERSPRACHE) — see the German block for the reasoning. Two words of
  // the English page are deliberately NOT quoted here, because they are themselves on the word list
  // this job removes: the lifecycle page calls a machine an „asset" (`lcy.assetTitle`), and the last
  // capture step is labelled „Review & submit" (`capture.submit`). Both are described instead of
  // quoted; no invented label stands in their place.
  "help.firststart.title": "First run & demo data",
  "help.firststart.body":
    "A freshly set-up installation brings no knowledge with it — nothing to read, nothing to check, nothing to find. So that you can still see how KLARWERK works, “Load demo data” under Admin creates an example stock: knowledge objects, open checks waiting on Validation, knowledge gaps and contradictions you can try every area on without risk. “Remove demo data” takes it away again, and your real stock stays untouched. Both need administration rights. Next step: open Admin, click “Load demo data”, then carry on with “Capture Knowledge”.",
  "help.library.title": "Library & knowledge object",
  "help.library.body":
    "The library is the whole body of knowledge in one place. The search field above finds an entry; filters, sorting, saved views and export sit in the “…” menu above the list. One click opens the knowledge object: its statement, its state and its source stand there straight away; sources and attachments, versions, history, comments and reported contradictions sit behind “More”. On a narrow device only one of the two fills the surface — either the list or the entry. Next step: click an entry, read the statement and open “More”.",
  "help.tasks.title": "Open tasks",
  "help.tasks.body":
    "The open work stands here in one place: objects waiting for you to check them on Validation, queries directed at you, reported contradictions, open knowledge gaps and objects that should be confirmed once more after a change to a machine or process. A coloured dot shows the urgency, the row of buttons above narrows the list down to one kind, and the “i” on a row tells you what is to be done there. Every row leads exactly to where the matter gets settled — as far as your role is allowed to see that area. Next step: click the top row and work it off.",
  "help.risk.title": "Risk & Gaps",
  "help.risk.body":
    "This page shows where knowledge is missing and where it hangs on one person alone. Every open knowledge gap carries its next step with it: judge the urgency, assign it to a specialist, or close it with “Capture knowledge”. Alongside that, the domains are coloured by how many people the knowledge recorded there came from — red means: all of it came from one person, nobody else has contributed to it so far. What helps against that is written on the red row itself. Next step: look at a red row, open its objects and assign the most urgent gap to someone.",
  "help.lifecycle.title": "Lifecycle & learning paths",
  "help.lifecycle.body":
    "Knowledge goes stale when the machine or the process changes. You report such a change and name the machine or process it concerns; every object that hangs on it is then marked for a fresh check and appears in the list of pending checks. Whoever works through that list decides per object: “Still valid → new version” — or it goes into rework; if an object has not been released at all yet, the way leads to Validation first. Next to it stands the learning path for your role: steps for getting started that you tick off with “Mark as done”. Next step: report a change, or tick off the top item of your learning path.",
  "help.validation.title": "Validation",
  "help.validation.body":
    "This is where the knowledge objects wait that need checking. You read the statement and decide: “Approve”, “Query” or “Reject” — the last two require a reason, and the object goes back into rework instead of being released. An object counts as validated only once enough green ratings have come together and no red one stands against it; how many are still missing is shown on each card. Next step: open the top object, read the statement and decide — if you are unsure, “Query” is the right way.",
  "help.stufe2.title": "Advanced modules (Stage 2): capital views & reports",
  "help.stufe2.body":
    "Beyond the core flow there are additional areas. An administrator unlocks them with “Advanced modules”; without that switch they stay invisible even when your role would be enough. The capital views read the stock as figures: how much knowledge is there, how much of it has been checked, what is still open — plus an estimate of the value, whose assumptions you enter yourself. The figures only display; nothing about the knowledge changes through them. Under “Reports” a document is built from validated knowledge objects. Next step: look at one figure, or choose a kind of document.",
  "help.mobile.title": "Mobile & offline",
  "help.mobile.body":
    "The mobile view shows KLARWERK at phone width, with the tabs “Capture”, “Ask” and “Search”: note something down on the move, ask something, look something up. Creating a draft needs the permission for it; whoever may read can ask and search here. Without a connection only the saving of a draft is queued and handed in later — asking and searching then say openly that they need a connection. Checking, releasing and settling contradictions do not exist here; for those, “To full version” at the top leads back. Next step: tap a tab.",
  "help.capture.title": "Capture knowledge",
  "help.capture.body":
    "This is where you write down what you know: type it, dictate it, photograph it or bring along a file you already have. The AI puts the raw material into shape — it suggests, you decide, and nothing is saved on its own. The way leads in steps from “Capture raw knowledge” through structuring to the final check; finished steps stay clickable, so you can go back without losing anything. What you submit becomes a knowledge object for colleagues to check — until then it stays your draft. Next step: open “Capture Knowledge” and start in your own words.",
  "help.fileimport.title": "Import a file: Word, PDF, PowerPoint, text and images",
  "help.fileimport.body":
    "The path starts under “Capture Knowledge”: in the “File” tool pick the entry “Import file”, then open a document with “Choose file” — or drag it onto the drop area.\n\nNext you decide what becomes of it: “Analyze into points” proposes individual knowledge points with a source excerpt, and you select what gets taken over; “Take over whole document” creates exactly one complete draft. Nothing is saved without your action, and a created draft is unreviewed and not submitted.\n\nAccepted are text files (.txt, .md, .markdown, .csv, .log, .json), Word (.docx), PDF, PowerPoint (.pptx) and images.",
  "help.validate.title": "Validate",
  "help.validate.body":
    "Rate objects green/amber/red. At the threshold an object is validated; red ratings go back to the author.",
  "help.ask.title": "Ask questions",
  "help.ask.body":
    "Ask your question in your own words. The answer is put together from the knowledge that exists and names the knowledge objects it rests on. Each of them shows its state, so you can see how solid the ground is. If there is no ground for it, nothing is invented: a knowledge gap is recorded, shows up under “Risk & Gaps” and can be assigned to someone there. Next step: type a question and jump from the answer into one of the named knowledge objects.",
  "help.conflict.title": "Conflicts",
  "help.conflict.body":
    "Contradictions are surfaced and resolved in a guided way. Only truth conflicts escalate to a human.",
  "help.roles.title": "Roles",
  "help.roles.body":
    "Viewer reads and asks, expert captures, controller validates and resolves, admin manages. You only see what your role allows.",
  "help.trust.title": "Trust",
  "help.trust.body":
    "Every statement carries a maturity grade from validation and use. Trust is evidence, not truth.",
  // JOB 3741 (SEITENHILFE-LUECKEN) — see the German block for the reasoning.
  "help.wissensnetz.title": "Topic map",
  "help.wissensnetz.body":
    "The topic map shows the body of knowledge from above: which topics exist, and which of them appear together in the same released knowledge objects. On a wide window you choose at the top between “Network” and “Reading” — the network draws every topic as a circle and puts the matching knowledge objects beside it as soon as you click one; on a narrow window there is no drawing and nothing to choose, the reading view stands there instead. In both cases a sentence per topic sits below it, with the way to its objects: find the topic that concerns you and go on from there.",
  "help.extern.title": "External knowledge",
  "help.extern.body":
    "Here you search sources outside Klarwerk without having to open a knowledge object first. You type a search term and get the hits back with their address; if external search is switched off or unreachable, the page says so openly instead of showing an empty list. Nothing found here moves into the stock by itself — whatever you need, you capture afterwards as your own knowledge object.",
  "help.konflikte.title": "Conflicts",
  "help.konflikte.body":
    "A conflict is a contradiction: two knowledge objects say something about the same matter, and both together cannot be true. The page puts the two statements side by side and lets you choose which one holds, whether both hold depending on context, or whether there is no contradiction at all. Your choice is kept as a note, nothing is deleted; take one pair and read both statements before you decide.",
  "help.duplikate.title": "Duplicates",
  // JOB 3890 — see the German block: the half-sentence now says what the button says, and the
  // wording is taken from `dup.side.both` and `dup.seitenhilfe.entscheidung.text` of this language.
  // Round 3: the place is NOT named here — see the German block for the two measured reasons (the
  // help search is a substring search, and Klara cuts every snippet at 700 characters). On
  // `/duplikate` the sentence below the chapter still names it.
  "help.duplikate.body":
    "Two knowledge objects that say largely the same thing land here as a pair. Unlike a conflict they do not contradict each other, they overlap. You decide which side is authoritative, whether both stay and are recorded as related, or whether it is no duplicate at all; nothing is merged and nothing is deleted, a note is written instead, and even “note as related” creates no link inside the objects. The decided finding leaves the list and the number on the tab; nothing is lost by that, because both knowledge objects stay unchanged. Take one pair and compare the two texts.",
  "help.analytics.title": "Analytics & Audit",
  "help.analytics.body":
    "This page bundles the evaluation across the whole stock and, next to it, the log of what happened: figures on validation, trust, gaps and workload on one side, the traceable list of events on the other. You can filter the log by kind of event and by the person who acted, to follow a single question. Pick one figure and trace its origin in the log.",
  "help.output.title": "Reports",
  "help.output.body":
    "A document is assembled here from knowledge that already exists. You pick the kind of document, put together the knowledge objects that belong in it and bring them into the order in which they should appear; a preview shows the assembly before the document is generated. Start with the kind of document, then choose the sources for it.",
  "help.import.title": "Import & Sources",
  "help.import.body":
    "This is where importing from outside sources happens: at the top you choose a source, look at what is in it and turn that into proposals — only what you select gets read in. The proposals themselves sit below in the collapsed “Review history” section, whose counter says how many of them are open; open it up and decide one with “Accept” or “Reject”, or attach a note. Decided proposals do not disappear and push nothing up — they stay in the list with their state, and you pick the next open one yourself.",
  "help.graph.title": "Knowledge Graph",
  // JOB 3889 — siehe den Kommentar an der deutschen Fassung: die Bedingung aus `graphNav.ts:12`
  // steht jetzt auch hier, mit derselben Wendung, die die Schwesterhilfe „in the holdings" benutzt.
  "help.graph.body":
    "The knowledge graph draws the individual knowledge objects and their connections as a net — closer to the object than the topic map, which groups by topic. If a node belongs to an object in the holdings, a click on it leads to that knowledge object, and the keyboard reaches it just as well; a node without such an object is not a link and is not in the keyboard order. Start at an object you know and follow its lines.",
  "help.gesamtanweisungen.title": "Assembling work instructions",
  "help.gesamtanweisungen.body":
    "Work instructions are readable step-by-step documents built from existing knowledge – for example for onboarding new colleagues. The overview shows every instruction you may read; clicking a title opens it. You start a new one with a title and “Create new work instruction”. In the open instruction you describe purpose, scope and prerequisites, search existing entries by title and add one fixed version of each as a section – a later change to the entry does not silently replace it. The reading view shows the result; “Move up” and “Move down” change the order. Finally you submit the whole instruction for a decision; people with review rights decide. “What has changed?” compares two saved states. An automatic expert review is not connected yet, and none of this needs AI.",
  "help.hilfe.title": "Help",
  "help.hilfe.body":
    "This page keeps every help chapter together, with a search field above it; each chapter carries a link to the page it is about. The search covers title, text and keywords of the chapters — so type in the word you would use to describe your problem. If there is nothing on it, the page says so openly instead of showing an unrelated chapter.",
  "help.profil.title": "Profile",
  "help.profil.body":
    "Your own details live in the profile: name and role, email address, the language of the interface and the way to sign out. You can switch the language here and change your password; under “My impact” you see figures about your own contributions only. If areas are missing from your menu, it can be down to your role — it stands next to your name here — or to the advanced modules being switched off; that switch lives under “Settings” and needs administration rights.",
  "mob.title": "Capture quickly",
  "mob.sub": "At the asset. In under two minutes.",
  "mob.dictate": "Record dictation",
  "mob.dictateSub": "Speak — the AI structures it",
  "mob.note": "Note",
  "mob.photo": "Photo",
  "mob.interview": "Interview",
  "mob.lookup": "Look up",
  "mob.modusGruppe": "Capture type",
  "mob.modusGesperrt": "Save or clear first, then switch the capture type.",
  "mob.iv.frage1": "What is this about? State the core message in one sentence.",
  "mob.iv.frage2": "Under what conditions or from when does this apply?",
  "mob.iv.frage3": "What action or consequence follows from it?",
  "mob.iv.frage4": "Which keywords/tags help to find it again? (comma-separated)",
  "mob.iv.fortschritt": "Question {{nummer}} of {{gesamt}}",
  "mob.iv.weiter": "Next question",
  "mob.iv.zurueck": "Previous question",
  "mob.iv.hinweis": "Every answer is in the draft right away — you can save after any question.",
  "mob.foto.kamera": "Camera",
  "mob.foto.mediathek": "Photo library",
  "mob.foto.entfernen": "Remove photo",
  "mob.foto.fehler": "The photo could not be read.",
  "mob.foto.max": "At most {{max}} photos per draft.",
  "mob.foto.inArbeit": "Preparing photo … you can save in a moment.",
  "mob.editing": "Resuming a draft.",
  "mob.formTitle": "Core statement",
  "mob.formStatement": "What happened / what applies?",
  "mob.save": "Save as draft",
  "mob.saved": "Draft saved.",
  "mob.update": "Update draft",
  "mob.updated": "Draft updated.",
  "mob.new": "New",
  "mob.drafts": "My drafts",
  "mob.draftsEmpty": "No drafts yet.",
  "mob.resume": "Resume",
  "mob.discard": "Discard",
  "mob.discarded": "Draft discarded.",
  "mob.discardConfirmHint": "Discard?",
  "mob.confirmDiscard": "Yes, discard",
  "mob.cancelDiscard": "Cancel",
  "mob.tabCapture": "Capture",
  "mob.tabAsk": "Ask",
  "mob.tabLookup": "Search",
  "mob.searchPlaceholder": "Search knowledge …",
  "mob.searchEmpty": "No matches.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Saved offline – will sync.",
  "mob.queue": "Queue",
  "mob.syncNow": "Sync",
  "mob.syncOk": "Synced",
  "mob.syncFail": "Sync failed",
  "mob.offlineSaveHint": "Offline – saving is queued locally.",
  "mob.offlineAsk": "Offline – asking needs a connection.",
  "mob.offlineSearch": "Offline – search needs a connection.",
  "mob.offlineNeedsConn": "Available again once you are back online.",
  "mob.status.queued": "queued",
  "mob.status.pending": "pending",
  "mob.status.synced": "synced",
  "mob.status.failed": "failed",
  // JOB 4354 — only the NAME of the message, never its content (that is the server's sentence).
  "mob.vorgang.grund": "Rejected — {{titel}}",
  // JOB 4193 — the stale-version prompt (mobile).
  "mob.stand.laedt": "Fetching the saved version …",
  "mob.stand.pruefungFehlt":
    "The saved version cannot be checked right now. Your text stays as it is — try again before you save.",
  "mob.stand.erneutPruefen": "Check again",
  "mob.stand.titelSpeichern":
    "This draft has been changed elsewhere in the meantime. Your version was NOT saved, and nothing was overwritten.",
  "mob.stand.titelOffline":
    "There is a version of this draft saved offline — and a different one on the server.",
  "mob.stand.felder": "Differs in",
  "mob.stand.feld.title": "Title",
  "mob.stand.feld.statement": "Core statement",
  "mob.stand.feld.body": "Text",
  "mob.stand.holen": "Fetch the new version",
  "mob.stand.behalten": "Keep my version",
  "mob.stand.offlineFassung": "Saved offline",
  "mob.stand.serverFassung": "Current server version",
  "mob.stand.meineFassung": "Your earlier version — not saved",
  "mob.stand.verwerfen": "Discard",
  "mob.stand.offlineHinweis":
    "Nothing is compared while offline. Whether someone else changed this draft shows when you reopen it with a connection.",
  "mob.stand.syncAbgewiesen":
    "Not sent: the draft was changed elsewhere. Open it to decide which version applies.",
  "mob.stand.erstAufloesen":
    "Resolve the prompt first: it is still open which version of this draft applies. Choose “Fetch the new version” or “Keep my version” — nothing is saved until then.",
  "mob.stand.syncBrauchtStand":
    "Not sent: this older entry has no version to check against. It stays queued — open the draft, then it is compared and sent.",
  "mob.ausgangUnklar":
    "No answer came back — whether it was saved is unclear. Reload the drafts and check before you save again.",
  // JOB 4249 — the queue sits on the device, but it belongs to an account.
  "mob.konto.laedt": "There are still queued items. Who they belong to is being checked …",
  "mob.konto.unbekannt":
    "There are still queued items. Who is signed in cannot be established right now — so nothing is sent and nothing is deleted. Sign in again to continue.",
  "mob.konto.eigeneLeer": "Nothing of yours is waiting.",
  "mob.konto.fremdeWarten":
    "Items from another account are queued here. They are not sent and not deleted — they wait until that account signs in again.",
  "mob.konto.ohneBindungWarten":
    "These older items have no account on record. They are assigned to nobody and deleted for nobody — sign in with the account they came from.",
  "mob.konto.fremdeNichtGesendet": "Not sent: belongs to another account.",
  "mob.konto.ohneBindungNichtGesendet":
    "Not sent: these older items have no account on record. They stay queued.",
  "mob.konto.syncWartet":
    "Nothing was sent: who is signed in is not established right now. Everything stays queued.",
  "mob.konto.speichernWartet":
    "Not saved yet: who is signed in is not established right now. Your text stays as it is — try again in a moment.",
  "mob.konto.laufAngehalten":
    "Sending was stopped because the account changed. The remaining items stay queued and still belong to the account that captured them.",
  "mob.konto.auffrischung":
    "Who is signed in is being confirmed right now. Nothing is sent until the answer is back — it continues on its own.",
  "mob.sitzung.unbeantwortet":
    "No network — your sign-in could not be verified. What you captured here is still on this device. Nothing is sent until the network is back and it is clear who is signed in.",
  "mob.sitzung.nurLokal":
    "Without a confirmed sign-in nothing from the server is shown here — not even from an earlier request. You only see what is stored on this device.",
  "s2.kicker": "Advanced · Stage 2",
  "s2.output":
    "Generate work instructions/checklists from validated objects — active once the output logic is in place.",
  "out.kindTitle": "Output type",
  "out.sourcesTitle": "Validated sources",
  "out.noValidated": "No validated knowledge objects yet.",
  "out.generate": "Generate output",
  "out.composeTitle": "Order & composition",
  "out.composeHint": "Set the order of the blocks — it is applied exactly when generating.",
  "out.moveUp": "Move up",
  "out.moveDown": "Move down",
  "out.removeFromOrder": "Remove from selection",
  "out.previewCompositionTitle": "Composition preview",
  "out.previewSummary": "{{kind}} from {{n}} validated blocks in this order.",
  "out.previewProvenance": "Full provenance per block is shown in the generated document.",
  "out.previewUncertain": "{{n}} block(s) with low trust — marked as uncertain in the document.",
  "out.previewDisclaimer":
    "Preview of the composition, not the finished document. Generation happens on Generate.",
  "out.previewTitle": "Preview (Markdown)",
  "out.copy": "Copy",
  "out.copied": "Markdown copied.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Provenance & evidence",
  "out.uncertain": "low trust",
  "out.genError": "Could not generate output.",
  "out.kind.instruction": "Work instruction",
  "out.kind.checklist": "Checklist",
  "out.kind.troubleshooting": "Troubleshooting",
  "out.kind.training": "Training",
  "out.kind.management_summary": "Management summary",
  "out.kindDesc.instruction": "Step-by-step procedure (SOP).",
  "out.kindDesc.checklist": "Checkable items for practice.",
  "out.kindDesc.troubleshooting": "Symptom → cause → action.",
  "out.kindDesc.training": "Learning units with key points.",
  "out.kindDesc.management_summary": "Condensed overview with trust.",
  "s2.import":
    "Import and review documents — active once the import/source-review API is in place.",
  "s2.capital":
    "Knowledge-capital metrics on real live data — active once the metrics logic is in place.",
  "mgmt.jumpTitle": "Sections",
  "mgmt.overview": "Operational snapshot",
  "mgmt.kpiTotal": "Objects",
  "mgmt.kpiValidated": "Validated",
  "mgmt.kpiOpen": "Open",
  "mgmt.kpiGaps": "Gaps",
  "mgmt.kpiConflicts": "Conflicts",
  "mgmt.kpiTrust": "Avg trust",
  "mgmt.capital": "Knowledge Capital Score",
  "mgmt.band.gut": "good",
  "mgmt.band.mittel": "medium",
  "mgmt.band.kritisch": "critical",
  "mgmt.part.validatedRatio": "Validation ratio",
  "mgmt.part.avgTrust": "Avg trust",
  "mgmt.part.coverage": "Domain coverage",
  "mgmt.part.singleSourceInv": "Source spread",
  "mgmt.part.freshnessInv": "Freshness",
  "mgmt.valuation": "Knowledge Valuation",
  "mgmt.valuationDisclaimer":
    "Estimate from transparent assumptions — not a balance-sheet valuation.",
  "mgmt.assumeRate": "€ per hour",
  "mgmt.assumeHours": "Hours saved/object",
  "mgmt.assumeReuse": "Reuse factor",
  "mgmt.basis": "Basis: {{n}} validated objects · avg trust {{trust}}",
  "mgmt.statement": "Knowledge Statement",
  "mgmt.assets": "Assets",
  "mgmt.risks": "Risks",
  "mgmt.net": "Net index",
  "mgmt.riskBreakdown":
    "Single-source domains: {{ss}} · stale: {{stale}} · open gaps: {{gaps}} · conflicts: {{conf}}",
  "mgmt.maturity": "Maturity Journey",
  "mgmt.stage": "Stage",
  "mgmt.stageName.leer": "No base",
  "mgmt.stageName.erfassen": "Capture",
  "mgmt.stageName.strukturieren": "Structure",
  "mgmt.stageName.validieren": "Validate",
  "mgmt.stageName.wiederverwenden": "Reuse",
  "mgmt.stageName.skalieren": "Scale",
  "mgmt.house": "Knowledge House",
  "mgmt.fragile": "fragile",
  "mgmt.stable": "secured",
  "mgmt.empty": "No base yet — metrics appear once knowledge is captured.",
  "mrun.title": "Reasoner runs (recent)",
  "mrun.empty": "No reasoner runs recorded yet.",
  "mrun.total": "Total: {{n}}",
  "mrun.errors": "Errors: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  "mrun.model": "Model: {{m}}",
  "mrun.duration": "Duration: {{d}}",
  "mrun.runtimeTotal": "Total runtime: {{d}} (from {{n}} of {{total}} runs)",
  "mrun.tokens": "Tokens: {{ein}} in · {{aus}} out",
  "mrun.tokensTotal": "Total tokens: {{ein}} in · {{aus}} out (from {{n}} of {{total}} runs)",
  "mrun.refreshFailed": "Refresh failed — showing the last loaded state.",
  "mrun.offline": "No connection — showing the last loaded state.",
  "evx.title": "Evidence index (QA)",
  "evx.empty": "No evidence records yet.",
  "evx.total": "Total: {{n}}",
  "evx.sources": "Sources: {{n}}",
  "evx.attachments": "Attachments: {{n}}",
  "evx.kos": "Knowledge objects: {{n}}",
  "evx.kind.source": "Source",
  "evx.kind.attachment": "Attachment",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Provider: {{v}}",
  "evx.objectPill": "Object: {{v}}",
  "prov.title": "Provenance index (QA)",
  "prov.empty": "No knowledge objects yet.",
  "prov.total": "KOs: {{n}}",
  "prov.transfer": "Transfer: {{n}}",
  "prov.multiVersion": "Multi-version: {{n}}",
  "prov.withEvidence": "with evidence: {{n}}",
  "prov.noEvidence": "without evidence: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "S {{sources}} · A {{attachments}} · Ev {{evidence}}",
  "prov.badge.no-evidence": "no evidence",
  "prov.badge.transferred-author": "author transfer",
  "prov.badge.multi-version": "multi-version",
  "kos.hintsTitle": "Knowledge-OS QA hints",
  "kos.sevCount.critical": "critical: {{n}}",
  "kos.sevCount.warning": "warnings: {{n}}",
  "kos.sevCount.info": "info: {{n}}",
  "kos.sev.critical": "critical",
  "kos.sev.warning": "warning",
  "kos.sev.info": "info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "No hints from the loaded signals.",
  "kos.hints.unknown": "Not loaded (unknown, not an error): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun errors ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner calls with error status — review the log.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail": "Runs used the deterministic fallback instead of a model.",
  "kos.hint.reasoner-demo.title": "Reasoner in demo/fallback mode",
  "kos.hint.reasoner-demo.detail": "No real model configured — answers are deterministic.",
  "kos.hint.provenance-no-evidence.title": "KOs without evidence ({{n}})",
  "kos.hint.provenance-no-evidence.detail": "Sources/attachments present but no evidence records.",
  "kos.hint.evidence-outdated.title": "Evidence outdated ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Current KO version has no evidence — only older versions are backed.",
  "kos.hint.evidence-missing.title": "Evidence missing ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Sources/object attachments present but no evidence for any version.",
  "kos.hint.provenance-lineage.title": "Transfer/multi-version ({{n}})",
  "kos.hint.provenance-lineage.detail": "KOs with author transfer or multiple versions.",
  "kos.hint.evidence-empty.title": "No evidence records",
  "kos.hint.evidence-empty.detail": "No sources/attachments captured as evidence yet.",
  // AUFTRAG-mega34 G.
  "kos.hint.health-detection-unproven.title": "Knowledge health not evidenced ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "Conflict detection is not fully evidenced. The value shown is therefore the worst possible one, not a measured grade — while that holds, neither an all-clear nor an alarm can be given honestly.",
  "kos.hint.health-critical.title": "Knowledge health critical ({{n}})",
  "kos.hint.health-critical.detail": "Overall score in the critical band.",
  "kos.hint.health-mittel.title": "Knowledge health medium ({{n}})",
  "kos.hint.health-mittel.detail": "Overall score in the medium band.",
  "kos.hint.all-clear.title": "No issues",
  "kos.hint.all-clear.detail": "The loaded foundation signals show no warnings.",
  "evFresh.title": "Evidence freshness (QA)",
  "evFresh.subtitle": "KOs whose current version has no evidence.",
  "evFresh.empty": "No KOs with outdated or missing evidence.",
  "evFresh.summary.outdated": "outdated: {{n}}",
  "evFresh.summary.missing": "missing: {{n}}",
  "evFresh.summary.current": "current: {{n}}",
  // UX-26 (arbeit:ux26-beleg-original-20260921): `evFresh.summary.neutral` lives in `texte/ux26.ts` now.
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "current {{current}} · older {{older}}",
  "evFresh.openKo": "Open KO",
  "qmWindow.within": "within the loaded window",
  "qmWindow.limited": "possibly truncated",
  "qmWindow.modelRuns": "Window: {{n}} most recent ModelRuns",
  "qmWindow.evidence": "Window: {{n}} most recent evidence records",
  "readiness.title": "Knowledge-OS readiness",
  "readiness.ready": "ready",
  "readiness.attention": "attention",
  "readiness.critical": "critical",
  "readiness.incomplete": "incompletely loaded",
  "readiness.reason.critical": "critical hints",
  "readiness.reason.warning": "warnings",
  "readiness.reason.window": "data window possibly truncated",
  "readiness.reason.unknown": "signals not loaded",
  "mrun.task.structure": "Structure",
  "mrun.task.assist": "Polish",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Answer",
  "mrun.task.select": "Select",
  // JOB 3069: Spiegel der DE-Schlüssel — siehe die Erläuterung dort.
  "mrun.task.extract": "Extract",
  "mrun.task.describe": "Describe image",
  "mrun.task.group": "Group",
  "mrun.task.enrich": "Enrich",
  "mrun.task.conflict": "Conflict check",
  "mrun.task.duplicate": "Duplicate check",
  "mrun.task.probe": "Provider probe",
  "mrun.cost": "Cost: {{k}}",
  "mrun.costStand": "Price list as of: {{s}}",
  "mrun.produced": "Produced: {{n}} × {{art}}",
  "mrun.erzeugnis.vorschlag": "suggestion",
  "mrun.erzeugnis.text": "text",
  "mrun.erzeugnis.frage": "question",
  "mrun.erzeugnis.antwort": "answer",
  "mrun.erzeugnis.punkt": "point",
  "mrun.erzeugnis.beschreibung": "description",
  "mrun.erzeugnis.gruppe": "group",
  "mrun.erzeugnis.kriterien": "selection criteria",
  "mrun.erzeugnis.urteil": "verdict",
  "mrun.report.title": "AI report (period)",
  "mrun.report.period": "Period:",
  "mrun.report.days": "Last {{n}} days",
  "mrun.report.costSum": "Total cost: {{k}} (from {{n}} of {{total}} runs)",
  "mrun.report.priceList": "Price list: as of {{s}}, {{w}}",
  "mrun.report.noPriceList": "No price list configured — costs are not calculated.",
  "mrun.report.withoutPrice":
    "{{n}} runs with model calls but no computable cost (price or usage missing)",
  "mrun.report.capped": "Very many runs — calculated over the most recent 10000.",
  "mrun.report.empty": "No AI runs in this period.",
  "mrun.taskUnknown": "Task type unknown",
  "mrun.status.success": "OK",
  "mrun.status.error": "Error",
  "rcfg.title": "Reasoner configuration",
  "rcfg.mode": "Mode",
  "rcfg.modeLabel.model": "Model active",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministic)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Model",
  "rcfg.notConfigured": "not configured",
  "rcfg.locales": "Languages",
  "rcfg.tasks": "Tasks",
  "rcfg.fallbackHint": "No model configured — deterministic fallback is active.",
  "mgmt.recommendations": "Hero Assist — recommendations",
  "mgmt.noRecs": "No urgent actions.",
  "mgmt.sev.hoch": "high",
  "mgmt.sev.mittel": "medium",
  "mgmt.rec.secureSingleSource": "Secure {{count}} single-source domain(s) (spread knowledge).",
  "mgmt.rec.revalidate": "Handle {{count}} due revalidation(s).",
  "mgmt.rec.closeGaps": "Close {{count}} open knowledge gap(s).",
  "mgmt.rec.resolveConflicts": "Resolve {{count}} open conflict(s).",
  "mgmt.rec.validateBacklog": "Validate {{count}} open objects.",
  "mgmt.priorities": "Knowledge prioritization (9 factors)",
  "mgmt.prio.filterLabel": "Filter prioritization",
  "mgmt.prio.filter.all": "All",
  "mgmt.prio.filter.busFactorOne": "Bus factor 1",
  "mgmt.prio.filter.stale": "Outdated",
  "mgmt.prio.filter.highProtection": "High protection value",
  "mgmt.prio.flag.busFactorOne": "bus factor 1",
  "mgmt.prio.flag.stale": "outdated",
  "mgmt.prio.flag.highProtection": "high protection value",
  "mgmt.prio.factor.busFactor": "Bus factor",
  "mgmt.prio.factor.criticality": "Criticality",
  "mgmt.prio.factor.processProximity": "Process proximity",
  "mgmt.prio.factor.age": "Age",
  "mgmt.prio.factor.sourceQuality": "Source quality",
  "mgmt.prio.factor.conflictDensity": "Conflict density",
  "mgmt.prio.factor.repetition": "Repetition frequency",
  "mgmt.prio.factor.damagePotential": "Damage potential",
  "mgmt.prio.factor.protection": "Protection value",
  "mgmt.prio.noData": "no input data",
  "mgmt.prio.noDataNote":
    "There is no input data in the holdings for {{factors}}. These factors are not estimated; the score comes from the others.",
  "mgmt.prio.detail": "Factor detail · calculated from {{known}} of 9 factors",
  "mgmt.prio.emptyFilter": "No category in this filter.",
  "mgmt.pilot": "Pilot report 30/60/90",
  "mgmt.print": "Print / PDF",
  "mgmt.pilotNote": "Print/HTML view (via browser print), not a certified PDF.",
  "mgmt.window": "Window",
  "mgmt.created": "Captured",
  "mgmt.validatedCol": "Validated",
  "mgmt.days": "days",
  "s2.graphEmpty": "No graph data.",
  "s2.graphCount": "{{nodes}} nodes · {{edges}} edges",
  "graph.truncated": "View limited to the {{n}} most connected nodes",
  "graph.legendValidated": "validated",
  "graph.legendOpen": "open / in review",
  "graph.legendTag": "tag relation",
  "graph.legendConflict": "conflict",
  "graph.clickHint": "Click a node to open the knowledge object",
  "graph.openNode": "Open knowledge object: {{title}}",

  // SCRUM-406: detailed ?-help in the review area (pattern: What? · When? · What happens next?).
  "vhelp.originFilter.title": "Filter by origin",
  "vhelp.originFilter.body":
    "Narrows the list by origin: demo examples or your organisation's own knowledge. This is a view only — it changes no review status and discards nothing. The number next to each filter shows how many entries it contains.",
  "vhelp.reviewFocus.title": "Review focus",
  "vhelp.reviewFocus.body":
    "Separates new submissions from reworked ones (version greater than 1). Reworked objects deserve a targeted look at the change — what was queried, what was adjusted? This too is a view only: it changes no status and replaces no decision.",
  "vhelp.filters.title": "Search & filter",
  "vhelp.filters.body":
    "Narrows the review list by full text, knowledge type, category or tag. Use it when the list is long and you want to review your own field first. Nothing is lost: filters only change what you currently see — every object stays in review.",
  "vhelp.mineOnly.title": "Assigned to me",
  "vhelp.mineOnly.body":
    "Shows your personal review list: objects someone deliberately assigned to you. Use it to clear the work colleagues are waiting for first. An assignment is a request, not a verdict — nothing is decided until you rate the object yourself.",
  "vhelp.signals.title": "Reading the review signals",
  "vhelp.signals.body":
    "This row shows how reliable the object is RIGHT NOW: the trust bar and trust value (from review votes and proven use), the version, „target n“ (that many approvals are needed until VALIDATED), plus markers such as TRANSFERRED (author changed — take an extra look) or ASSIGNED. None of this is your rating — it is the honest starting point for your decision.",
  "vhelp.approve.title": "Approve",
  "vhelp.approve.body":
    "You confirm after your own review: this statement is factually correct and applicable as written. Use it only once you have genuinely judged the statement, conditions and measures — your approval counts as one of several required review votes. Afterwards the object's trust rises; it only becomes VALIDATED once enough reviewers have approved. Nothing is published or changed automatically — your vote is counted, nothing more.",
  "vhelp.query.title": "Raise a query",
  "vhelp.query.body":
    "You consider the knowledge usable, but something is unclear, incomplete or only true under conditions. A short comment is mandatory — it is your help to the author: what exactly is missing, what should they add? Afterwards the object stays in review and the author sees your query as a comment on the knowledge object. Nothing is rejected, approved or changed automatically — the rework is done deliberately by the author.",
  "vhelp.reject.title": "Reject",
  "vhelp.reject.body":
    "You consider the statement wrong, outdated or risky. Here too the reason is mandatory — without it the author can learn and correct nothing. Your rejection then flows into the object's review record; it is NOT deleted and NOT locked, but remains visibly in review until the author or a controller reacts. If two validated statements contradict each other, „report conflict“ is the better path than a rejection.",
  "vhelp.feedbackForm.title": "Reason (mandatory)",
  "vhelp.feedbackForm.body":
    "Queries and rejections always need a reason — it is stored as a comment on the knowledge object, visible to author and reviewers. Be concrete about what is missing or wrong and what the author should add. Submitting requires text; cancelling only discards your input, never a rating.",
  "vhelp.assign.title": "Assign a reviewer",
  "vhelp.assign.body":
    "You ask a specific colleague to review this object. They will see it in their personal review list („assigned to me“) and receive a notification via the bell. The assignment is an invitation, not a rating: it changes neither status nor trust, and nothing is reviewed until that person decides themselves.",
  "vhelp.markTrue.title": "Mark as true (admin only)",
  "vhelp.markTrue.body":
    "As an admin you complete this object's validation in a single step — regardless of the peer ratings. The status is set to „validated“ and trust is raised to the highest level. Use this deliberately and only when you can genuinely vouch for the statement, because you are skipping the multiple cross-checks by others. The action is recorded in the audit log under your name and can later be pulled back into review via a fresh edit/revision.",
  "vhelp.stillValid.title": "Still valid",
  "vhelp.stillValid.body":
    "You confirm that this already reviewed knowledge still holds from your point of view — a freshness signal, not a new review procedure. Use it when you have just applied the knowledge or deliberately re-read it. The confirmation is recorded with a date and the object counts as recently confirmed. It replaces no peer review and lifts no queries or conflicts.",
  "vhelp.reportConflict.title": "Report a conflict",
  "vhelp.reportConflict.body":
    "You flag that this knowledge contradicts ANOTHER knowledge object — say, two different limit values for the same case. The case then appears on the conflicts page and is resolved deliberately there (second opinion, escalation, documented decision). Both objects remain unchanged — nothing is corrected, overwritten or deleted automatically.",
  "vhelp.conflictForm.title": "Describe the conflict",
  "vhelp.conflictForm.body":
    "Three details make the report resolvable: the COUNTERPART object (what does this knowledge contradict?), the CONFLICT TYPE (e.g. contradiction in substance or in responsibility) and a short DESCRIPTION of the contradiction with your context. After submitting, an open conflict case exists — both objects stay marked as usable until the conflict is deliberately resolved.",
  "vhelp.sourcesLevel2.title": "External sources (level 2)",
  "vhelp.sourcesLevel2.body":
    "External evidence attached to the knowledge object: standards, manuals, articles, internal documents. The „level 2“ badge is honest: this source was NOT peer-reviewed by colleagues — it supports the knowledge but replaces not a single review vote. On the Ask page a level-2 source therefore does not count as a review vote; it can support an answer, but not secure it. The X only removes the link — knowledge, status and trust remain unchanged.",
  "vhelp.sourceFields.title": "Describe the source",
  "vhelp.sourceFields.body":
    "Three details make a source useful: the LABEL says what it is („DIN EN 1090, section 7“), the URL leads to it (leave empty for paper or internal sources), the EXCERPT quotes the one decisive passage verbatim — so nobody has to read the whole document to check the statement. The more concrete the excerpt, the more the source helps reviewers.",
  "vhelp.sourceAdd.title": "Add source",
  "vhelp.sourceAdd.body":
    "Attaches the described source to this knowledge object as level-2 evidence. It persists across versions and is visible to everyone. Nothing else happens automatically: the source's content is not merged into the knowledge, not reviewed and not rated — it stands next to it as evidence.",
  "vhelp.sourceSearch.title": "Search sources",
  "vhelp.sourceSearch.body":
    "Searches for external evidence on this topic. The search runs through the KLARWERK server — your query does not go from your browser to external services directly. Results are non-binding suggestions: nothing is attached automatically. Check title and snippet, open the link if in doubt — only „attach“ deliberately adopts a result as a level-2 source.",
  "vhelp.contribution.title": "Report a contribution or reference",
  "vhelp.contribution.body":
    "You know an addition, correction or reference but do not want to work on the object yourself? Describe it here — your note is stored as a comment on the knowledge object, visible to author and reviewers. Unlike „add source“, NO source entry is created; it is a message to people, not evidence on the object.",
  "vhelp.helpful.title": "It helped",
  "vhelp.helpful.body":
    "A proven-in-practice signal: you applied this knowledge and it worked. It strengthens the object's trust a little and is recorded in the history. It is NOT a review vote — validation still only comes from deliberate review decisions by colleagues.",
  "vhelp.validity.title": "Validity & protection",
  "vhelp.validity.body":
    "These values are honestly DERIVED from the current state, not stored: freshness (when last confirmed or changed), output eligibility (may this knowledge go into generated documents?) and a recommendation for the next sensible step. You can only change them indirectly — by reviewing, confirming or reworking the knowledge itself.",
  "vhelp.transfer.title": "Transfer author",
  "vhelp.transfer.body":
    "Hands responsibility for this knowledge to another person — for instance when someone leaves the company or responsibility changes. The original author remains permanently visible (provenance is never lost). Transferred objects get an extra look in review, because the knowledge is now owned by someone who did not capture it.",
  "vhelp.deleteKo.title": "Delete knowledge object",
  "vhelp.deleteKo.body":
    "Removes this knowledge object permanently — allowed only for the author, controllers and admins; the server enforces the same rule. The inline confirmation deliberately asks before deleting, and the deletion is recorded in the audit log. If the knowledge is merely outdated, reworking it or reporting a conflict is the more honest path than deletion.",
  "vhelp.conflictEscalate.title": "Escalate",
  "vhelp.conflictEscalate.body":
    "Raises an open factual conflict one level when the people involved cannot settle it themselves — the responsible authority then decides. Use it when two validated statements contradict each other hard and neither side can yield. The conflict stays open and visible until a documented decision is made.",
  "vhelp.conflictSecondOpinion.title": "Get a second opinion",
  "vhelp.conflictSecondOpinion.body":
    "Asks another knowledgeable person for their assessment of the conflict and records it in writing. A good second opinion names facts and sources, not just gut feeling. It does not decide the conflict automatically — it is material for the later resolution.",
  "vhelp.conflictResolve.title": "Resolve conflict",
  "vhelp.conflictResolve.body":
    "Records the decision on how to handle the contradiction — which statement applies, under which conditions, and why. The resolution only DOCUMENTS: it changes none of the involved knowledge objects automatically. If an object should be reworked or reconfirmed afterwards, the app shows a revalidation recommendation — that too remains a deliberate human action.",

  // SCRUM-407: detailed ?-help along the capture flow (pattern: What? · When? · What happens next?).
  "chelp.modes.title": "The four ways to tell",
  "chelp.modes.body":
    "Four paths lead to the same goal: FREE TEXT (just start writing), DICTATION (speak instead of typing), INTERVIEW (the AI asks you targeted questions) and FROM FILE (pull knowledge points out of a document). Pick whatever feels natural — all paths end in the same draft on the knowledge page, and nothing is lost when you switch.",
  "chelp.expertPath.title": "Direct form (expert path)",
  "chelp.expertPath.body":
    "The classic form with every field at once — for those who know exactly what to enter. It is the same data as the guided path, no extra feature and no shortcut past review. The way back to the guided path is always one click away.",
  "chelp.wizardSteps.title": "The three steps",
  "chelp.wizardSteps.body":
    "Capturing runs in three steps: WRITE (title and text on the sheet — or via “File” as an interview, from a file or in the form; “Dictate” writes along), SAVE (as a draft, visible only to you) and SUBMIT (hand it to peer review). You can keep writing at any time — nothing is lost. Only submitting turns your draft into a knowledge object for your colleagues.",
  "chelp.loadExample.title": "Load example",
  "chelp.loadExample.body":
    "Fills the fields with a demo example so you can try the whole path safely. Careful: it overwrites your current input — use it on an empty page. Even an example is only submitted once you submit it deliberately.",
  "chelp.tellRaw.title": "Just tell it",
  "chelp.tellRaw.body":
    "Write your knowledge down the way you would tell a new colleague — unsorted is perfectly fine. Structure (title, core statement, conditions, measures) is PROPOSED by the AI in the next step, for you to check and change. Nothing is saved or submitted automatically.",
  "chelp.dictate.title": "Dictate",
  "chelp.dictate.body":
    "Speak instead of typing: your browser converts speech to text locally and it flows into this field. Start and stop deliberately; afterwards you can edit the text as usual. If your browser cannot do speech recognition, the app says so honestly instead of failing silently.",
  "chelp.tellUpload.title": "Attach a file while telling",
  "chelp.tellUpload.body":
    "Upload documents here (PDF, Word, text) and their text flows straight into your telling field; images and videos become attachments of the later knowledge object. For images, text recognition (OCR) only runs on your click. Nothing is uploaded that you do not see — everything stays part of your draft.",
  "chelp.structureNow.title": "Propose structure",
  "chelp.structureNow.body":
    "The AI reads your raw text and proposes title, core statement, conditions and measures — as a DRAFT on the knowledge page, marked in violet. It invents nothing; without an AI key an honest, rule-based fallback works and says so clearly. You check, change and decide — nothing is ever saved automatically.",
  "chelp.interview.title": "The knowledge interview",
  "chelp.interview.body":
    "The AI asks you one question at a time and digs deeper on purpose — for limit values, exceptions, reasons. Answer in your own words (type or dictate); you can have the question read aloud. Only when you finish the interview is a draft built from all your answers — none of it is stored before that.",
  "chelp.filePoints.title": "Knowledge from a file",
  "chelp.filePoints.body":
    "You upload a document and the AI extracts individual knowledge points — each WITH a verbatim quote from the document (which rules out invented points; if it finds nothing solid, it says so honestly). You tick what gets adopted: only selected points become drafts. Alternatively you can phrase a search assignment for an expert.",
  "chelp.captureTitle.title": "The title",
  "chelp.captureTitle.body":
    "The title is the first thing colleagues see in the library and in answers — it decides whether your knowledge is found. Good: concrete and actionable („checking weld seams on aluminium under 5 mm“). You can change it anytime; the AI suggestion is only a starting point.",
  "chelp.saveDraftHelp.title": "Save draft",
  "chelp.saveDraftHelp.body":
    "Saves your interim state privately on the server — continue anytime, on any of your devices and even after a restart. A draft is NOT submitted: only you can see it, and it appears in no review and no answer. You find your saved drafts to resume under “More” → Drafts and in the menu under My drafts.",
  "chelp.discardHelp.title": "Discard",
  "chelp.discardHelp.body":
    "Discards the current input — text, structure and attachments of this capture. It affects ONLY this input: already submitted knowledge objects and saved drafts stay untouched. The app deliberately asks first.",
  "chelp.submitReview.title": "Review & submit",
  "chelp.submitReview.body":
    "Turns your draft into a knowledge object and hands it to peer review: colleagues check it, raise queries or approve. From now on it is visible to others — but honestly marked as „in review“, NOT as validated. It becomes validated through enough approvals. It can carry answers before that too — but is then visibly marked as unverified.",
  "chelp.readiness.title": "Readiness check",
  "chelp.readiness.body":
    "Shows honestly what is still missing before submitting: mandatory fields (without them the button stays off) and optional ones that strengthen your knowledge (category or attachments, say). Green means ready — not perfect: you can still improve after submitting, then as a new version.",
  "chelp.savedNext.title": "Saved — what now?",
  "chelp.savedNext.body":
    "Your knowledge now exists as an object and awaits peer review — it is VISIBLE, but honestly marked as open, not as validated. Nothing more to do: reviewers will find it on the validation board. If you want to view or extend it, the link takes you straight there.",
  "chelp.advancedDetails.title": "Advanced details",
  "chelp.advancedDetails.body":
    "Everything here is OPTIONAL — your knowledge gets submitted without it too. It is still worth it: category and tags make it findable, the asset couples it to machines/objects, the reviewer count steers how many approvals are needed, documents and images provide evidence. The badge shows how much is already filled in.",
  "chelp.knowledgeType.title": "Knowledge type",
  "chelp.knowledgeType.body":
    "Classifies your knowledge: experience, process, factual — and especially valuable: NEGATIVE knowledge („we tried this, it does NOT work, because …“). The type helps reviewers and searchers put your knowledge in context; it changes nothing about the review path.",
  "chelp.assetField.title": "Asset / object",
  "chelp.assetField.body":
    "Couples your knowledge to a concrete asset, machine or object („press 3“, „client XY“). If that asset changes later, the lifecycle finds exactly the coupled knowledge objects for re-checking. Free text is fine — as long as colleagues recognise the asset.",
  "chelp.tagsField.title": "Tags",
  "chelp.tagsField.body":
    "Short keywords through which your knowledge appears in search and filters („aluminium“, „deadline“, „hygiene“). Use terms colleagues would actually search for, and stay consistent with existing tags. They can be changed anytime and do not influence the review.",
  "chelp.docsImages.title": "Documents & images",
  "chelp.docsImages.body":
    "Attaches evidence to your knowledge: photos of the result, the inspection log, the work instruction. Attachments travel with the knowledge object on submit and are visible to reviewers there. Their content does not become knowledge automatically — you decide what goes into the text.",
  "chelp.expertForm.title": "The expert form",
  "chelp.expertForm.body":
    "Enter all fields directly here: title, knowledge type, content, core statement, conditions (when does it apply?) and measures (what is to be done?). The same rules apply as on the guided path — same readiness check, same review. The AI helps with the text on request but decides nothing.",
  "chelp.sourcesPanel.title": "External sources (level 2)",
  "chelp.sourcesPanel.body":
    "Attaches external references to your knowledge — a standard, a manual, a manufacturer page. By hand (label, link, excerpt) or via the source search, exactly like in the review area. While capturing, they collect in a visible waiting list; they are attached only on submit, together with your knowledge object. Important: external sources are level 2 — they never count as peer-validated and do not replace review by colleagues. Nothing is adopted automatically.",
  "capture.sourcesTitle": "External sources",
  "capture.sourcesHint":
    "Sources first land in this waiting list. On submit they are attached to the saved knowledge object — as level 2, never peer-validated.",
  "xtr.title": "Add from document",
  "xtr.hint":
    "Upload another document — the AI reads it and suggests knowledge points WITH their supporting excerpt. Only what you tick is appended as a section at the end of your article; nothing is replaced.",
  "xtr.applyCta": "Append selected",
  "xtr.applying": "Adopting {{count}} point(s) — content and provenance together …",
  "xtr.appended":
    "{{count}} point(s) from „{{name}}“ adopted — content AND provenance were saved together; existing content was left unchanged.",
  "xtr.append.button": "Append to existing article",
  "xtr.append.title": "Append to existing article",
  "xtr.append.intro":
    "Append {{count}} selected insight(s) from „{{name}}“ as a section to an existing article. The target article is revised (re-review needed afterwards); the source is noted per point.",
  "xtr.append.searchPlaceholder": "Search articles (title) …",
  "xtr.append.none": "No matching article found.",
  "xtr.append.busy": "Appending …",
  "xtr.append.done":
    "{{count}} insight(s) appended to „{{title}}“ — the article now needs re-review.",
  "xtr.append.missingAnchor":
    "Without the original document as evidence the content is not adopted. The article was NOT changed. This holds regardless of the “External knowledge” setting: adopted document content must stay attached to its original.",
  "xtr.append.blockedByStage":
    "At the configured “External knowledge” stage this source may not be attached to a knowledge object. The article was NOT changed. An administrator can change the stage under Administration → External knowledge.",
  "xtr.append.unclear":
    "The outcome is unclear — the connection dropped before the server answered. NOTHING was taken back: the adoption may or may not have gone through. Please open the article and check; retrying the same operation will not create anything twice.",
  "xtr.append.stateUnchanged":
    "The article was NOT changed — no content was saved without its provenance. You can simply try the import again.",
  "xtr.append.followUpsFailed":
    "The adoption is saved (content and provenance). A downstream step did not run: {{steps}}. The renewed AI check may therefore be missing — it can be restarted on the validation page.",
  "xtr.help.title": "Add from document",
  "xtr.help.body":
    "The AI reads a document you upload and suggests knowledge points — each point carries its supporting excerpt from the document (no excerpt, no adoption). You choose via checkboxes; the selection is APPENDED to your article as sections, nothing is replaced or overwritten. The origin (file name + excerpt) is noted on the knowledge object as a level-2 source — it does not count as peer-validated and does not replace review.",
  "fd.kicker": "Capture",
  "fd.title": "Document editor",
  "fd.backToCapture": "Back to capture knowledge",
  "fd.allModes": "All capture modes",
  "fd.submitted": "Submitted for review:",
  "fd.submittedBody":
    "The editor is finished and cleared. Saving or re-submitting the same content is locked; a new entry only starts deliberately via the button.",
  "fd.openValidation": "Open validation",
  "fd.viewObject": "View object",
  "fd.newEntry": "New entry",
  "fd.titleOptional": "Title optional",
  "fd.content": "Content",
  "fd.draftLoading": "Loading draft ...",
  "fd.draftOpen": "Front-door draft opened. Changes stay in this draft.",
  "fd.editorPlaceholder":
    "Describe your knowledge here the way you would explain it to a colleague — the AI turns it into a draft that you review and submit.",
  "fd.structureSuggest": "Suggest AI structure",
  "fd.needContentFirst": "Write some content first, then a suggestion can be generated.",
  "fd.optionalAiHint": "Optional AI suggestion. Nothing is saved automatically.",
  "fd.aiHelp": "AI help",
  "fd.aiHelpApply": "Apply AI help",
  "fd.aiHelpModes": "Clarify, structure, expand, spelling or format.",
  "fd.structureGenerating": "Generating AI suggestion ...",
  "fd.assistGenerating": "Generating AI help suggestion ...",
  "fd.originalUnchanged": "The original text stays unchanged.",
  "fd.structureAccepted":
    "AI suggestion adopted. Please review; nothing is saved until your next action.",
  "fd.structureKeptRichBodyTitle":
    "Structure suggestion: title adopted. The formatted content with images and formatting stays unchanged.",
  "fd.structureKeptRichBodyNoTitle":
    "The formatted content stays unchanged; the structure suggestion was not applied to the content.",
  "fd.structureRichTitleOnly":
    "Formatted content with images stays intact — the AI only suggests a title.",
  "fd.assistAccepted": "AI help adopted. Please review; nothing is saved until your next action.",
  "fd.aiProposal": "AI suggestion",
  "fd.aiProposalCheck": "AI-generated. Please review before you adopt anything.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "AI is not configured or disabled — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackModelError":
    "AI reported an error or was not reachable — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackModelTimeout":
    "AI did not respond in time (timeout) — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackConfidential":
    "The text is classified as confidential — the cloud AI is excluded for it and no local model is wired. This suggestion is a simple automatic derivation, not a model response.",
  "fd.fieldTitle": "Title",
  "fd.fieldStatement": "Statement / core message",
  "fd.fieldConditions": "Conditions",
  "fd.noConditions": "No conditions suggested.",
  "fd.fieldMeasures": "Measures",
  "fd.noMeasures": "No measures suggested.",
  "fd.fieldTags": "Notes / tags",
  "fd.aiHelpProposal": "AI help suggestion",
  "fd.assistProposalCheck": "{{action}}: AI-generated. Please review before you adopt anything.",
  "fd.accept": "Adopt",
  "fd.discardProposal": "Discard suggestion",
  "fd.submitReview": "Review & submit",
  "fd.saveDraft": "Save as draft",
  "fd.discardInput": "Discard input",
  "fd.back": "Back",
  "fd.writeToSubmit": "Write or paste content, then you can review and submit.",
  "fd.validate.lead": "Submitting is not possible yet:",
  "fd.validate.needBody": "The content is empty. To submit, the knowledge object needs text.",
  "fd.validate.hint": "You can still save the empty state as a draft and continue later.",
  "fd.unsavable.proposal":
    "The AI proposal on screen has not been adopted and will not be saved along with the draft.",
  "fd.unsavable.confidentialityOnly":
    "The chosen confidentiality without a title and without content — there is no draft yet that could hold it.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Title on save",
  "fd.author": "Author",
  "fd.whatOnSave": "What happens on save",
  "fd.whatOnSaveBody":
    "It is saved as a draft — resumable at any time. It only goes to review when you choose “Submit”; nothing is validated automatically.",
  "fd.moreWays": "More capture paths",
  "fd.moreWaysBody":
    "Need the classic form, dictation or the guided interview? The full capture area has every path — this surface here is the fast entry point.",
  "fd.options.show": "Show more input options",
  "fd.options.hide": "Collapse more input options",
  "fd.options.hint.freitext":
    "Tell it freely; the AI turns it into a structure proposal that you review.",
  "fd.options.hint.diktat": "Speak instead of typing — the text lands in the same telling field.",
  "fd.options.hint.interview": "Guided follow-up questions when you don't know where to start.",
  "fd.options.hint.datei": "Take knowledge from an existing file.",
  "fd.options.hint.formular":
    "Expert mode: fill the same fields directly, without the telling step.",
  "fd.toastSaved": "Draft saved.",
  "fd.saved.line": "Draft saved: {{titel}} — you keep writing in this draft here.",
  "fd.saved.toDrafts": "My drafts",
  "fd.toastSubmitted": "Submitted for review.",
  "fd.confirmDiscard": "Discard input? Unsaved content will be lost.",
  "fd.confirmOpenDraft": "Open a different draft? Unsaved content on this sheet will be replaced.",
  "fd.errSaveFailed": "Saving failed.",
  "fd.errLoadFailed": "The draft could not be loaded. Nothing was saved.",
  "erfassen.laden.nichtBereit":
    "The draft is being fetched. Until it is here, this sheet accepts nothing — otherwise the loaded text would overwrite what you wrote.",
  "fd.draftStale":
    "This draft has since been changed elsewhere — for example in a second tab. Your version here was NOT saved and nothing was overwritten. “Reload” fetches the other version; what you typed here will be lost — copy it first if you want to keep it.",
  "fd.draftStaleReload": "Reload",
  "fd.errAssist": "I cannot run this AI help reliably right now.",
  "fd.errSpelling": "The spell check cannot safely preserve formatting at the moment.",

  // JOB 3062 · H3 — the sheet (Pages).
  "erfassen.werkzeug.diktieren": "Dictate",
  "erfassen.werkzeug.bild": "Image",
  "erfassen.werkzeug.datei": "File",
  "erfassen.werkzeug.ki": "AI",
  "erfassen.werkzeug.bereich": "Area",
  "erfassen.werkzeug.vertraulichkeit": "Confidentiality",
  "erfassen.werkzeug.hilfe": "?",
  "erfassen.werkzeug.mehr": "More",
  "erfassen.weg.datei": "Import file",
  "erfassen.weg.interview": "Run interview",
  "erfassen.weg.formular": "Form (experts)",
  "erfassen.ki.struktur": "Suggest structure",
  "erfassen.ki.pille": "AI",
  "erfassen.mehr.entwuerfe": "Drafts",
  "erfassen.mehr.anhaenge": "Attachments",
  "erfassen.mehr.status": "Status",
  "erfassen.mehr.beispiel": "View example",
  "erfassen.mehr.klara": "Klara in Word",
  "erfassen.mehr.zurueck": "Back",
  "erfassen.bereich.leeren": "No area",
  "erfassen.entwuerfe.keine": "No drafts yet.",
  "erfassen.anhaenge.keine": "No attachments in the text yet.",
  "erfassen.anhaenge.anzahl": "{{n}} image(s) in the text.",
  "erfassen.anhaenge.verwalten": "Manage attachments",
  "erfassen.beispiel.keins": "There is no matching example in the stock yet.",
  "erfassen.platzhalter.titel": "Title",
  "erfassen.platzhalter.text": "Text",
  "erfassen.entwurfSichern": "Save draft",
  "erfassen.einreichen": "Submit",
  "erfassen.eingereicht": "Submitted:",
  "erfassen.live.aehnlich": "Similar to:",
  "erfassen.live.widerspruch": "May contradict:",
  "erfassen.live.neu": "This is new",
  "erfassen.status.livePruefung": "Live check",
  "erfassen.hilfe.bilder": "Inserting images",
  "erfassen.erneutVersuchen": "Try again",
  "dcmp.kicker": "Read-only comparison",
  "dcmp.titleDuplicate": "Compare duplicates",
  "dcmp.titleConflict": "Compare conflict",
  "dcmp.back": "Back",
  "dcmp.loading": "Loading comparison.",
  "dcmp.loadError": "Comparison could not be loaded.",
  "dcmp.notFound": "Comparison not found or already closed.",
  "dcmp.textSimilarity": "Text similarity",
  "dcmp.noProvenContradiction": "no proven contradiction — only word/field similarity",
  // REVIEW26 (JOB 3469): the bridge sentence, shown only when the two surfaces really do lead
  // with different metrics for the same pair.
  "dcmp.metricBridge":
    "One pair, two measurements: the “Duplicates” board shows {{board}}, this page shows {{compare}}. Not a contradiction — the two numbers measure different things.",
  "dcmp.moreValues": "More values",
  "dcmp.uncertainty": "Uncertainty",
  "dcmp.textDifference": "Text difference",
  "dcmp.similarity": "Similarity",
  "dcmp.scoresHint": "Scores are decision support, not truth. No automatic merge.",
  "dcmp.viewDetails": "View details",
  "dcmp.objectRemoved": "Object removed",
  "dcmp.left": "Left",
  "dcmp.right": "Right",
  "dcmp.koA": "Knowledge object A",
  "dcmp.koB": "Knowledge object B",
  "dcmp.sectionSignals": "Section signals",
  "dcmp.compareByAreas": "Comparison by knowledge area",
  "dcmp.legendHelpTitle": "What do the signal colours mean?",
  "dcmp.legendHelpBody":
    "Each section gets a colour from the text comparison: green = the contents largely match, yellow = partial or unclear (take a closer look), red = the texts differ. Red only means a difference, not a proven contradiction — the colours are a reading aid, not a verdict, and nothing is merged automatically.",
  "dcmp.onlyForComparison":
    "For comparison only: nothing is merged, deleted or validated, and no decision is saved.",
  // JOB 3671 — page help of the comparison page. It POINTS AT the existing colour legend instead
  // of repeating it; the legend's own title is inserted as {{legende}}. Reasoning at the DE keys.
  "dcmp.seitenhilfe.titel": "Compare, do not decide",
  "dcmp.seitenhilfe.text":
    "This page puts the same two objects as the board opposite each other; on narrow windows one below the other — the upper card is the one called “Left” in the field-by-field comparison. The “{{mehr}}” disclosure holds similarity, uncertainty, text difference and that field comparison; what the three signal colours mean is explained there by the legend “{{legende}}” — it is not repeated here. Nothing is saved on this page: it does not merge, delete or validate, and it records no decision. So there is nothing you can get wrong here; decisions are made on the “{{brett}}” board, and the tab of the same name at the top leads back there.",
  "dcmp.sourceDuplicate": "Duplicate comparison: {{relation}}",
  "dcmp.sourceConflict": "Conflict comparison: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Section comparison not possible because a knowledge object is missing.",
  "dcmp.relation.identisch": "identical",
  "dcmp.relation.a_enthaelt_b": "A contains B",
  "dcmp.relation.b_enthaelt_a": "B contains A",
  "dcmp.relation.teilweise": "partial overlap",
  "dcmp.relation.verwandt": "related",
  "dcmp.conflictType.truth": "Truth conflict",
  "dcmp.conflictType.experience": "Experience conflict",
  "dcmp.conflictType.context": "Context conflict",
  "dcmp.conflictType.temporal": "Temporal conflict",
  "dcmp.conflictType.role": "Role conflict",
  "dcmp.tone.green.label": "Match",
  "dcmp.tone.green.meaning": "Text and fields largely match.",
  "dcmp.tone.yellow.label": "Uncertain",
  "dcmp.tone.yellow.meaning": "Partial or unclear — take a closer look.",
  "dcmp.tone.red.label": "Difference",
  "dcmp.tone.red.meaning": "Text differs — only a difference, not a proven contradiction.",
  "dcmp.section.title": "Title",
  "dcmp.section.statement": "Core message / content",
  "dcmp.section.conditions": "Conditions",
  "dcmp.section.measures": "Measures",
  "dcmp.section.hints": "Notes",
  "dcmp.section.sources": "Sources / evidence",
  "dcmp.section.tags": "Tags / category",
  "dcmp.section.trust": "Trust / validation status",
  "dcmp.note.bothEmpty": "Preliminary field heuristic; no real detector scores for this section.",
  "dcmp.note.exactMatch": "Preliminary field heuristic; exact field match.",
  "dcmp.note.oneMissing": "Preliminary field heuristic; one value is missing.",
  "dcmp.note.heuristic": "Preliminary field heuristic; not a factual verdict.",
  "dcmp.note.noScore":
    "No score available: overall values are a preliminary field heuristic without detector percentages.",
  "dcmp.note.mixedOverlap":
    "Match from the existing detector; conflict/uncertainty remain a preliminary display aid.",
  "dcmp.note.mixedConflict":
    "Conflict value from the existing detector; match remains a preliminary field heuristic.",
  "dcmp.reason.bothEmpty": "Neither side has a usable value.",
  "dcmp.reason.identical": "The values are identical.",
  "dcmp.reason.oneMissing": "One value is missing, so no real conflict can be inferred.",
  "dcmp.reason.strongDiff": "The field values differ strongly and must be reviewed professionally.",
  "dcmp.reason.partialDiff": "The field values differ partly and must be reviewed.",
  "cfd.fallbackTitle": "Untitled knowledge object",
  "cfd.structuringUnavailable": "I can't reliably organise this right now.",

  // AUFTRAG-mega61: legal pages, notice banner, AI transparency. Sense-for-sense translation of the
  // German source, which remains the legally authoritative wording.
  "legal.pending": "— to be added —",
  "legal.tbd.company": "— to be added —",
  "legal.tbd.address": "— to be added —",
  "legal.tbd.representative": "— to be added —",
  "legal.tbd.email": "— to be added —",
  "legal.tbd.phone": "— to be added —",
  "legal.tbd.register": "— to be added —",
  "legal.tbd.vatId": "— to be added —",
  "legal.tbd.responsible": "— to be added —",
  "legal.tbd.supervisoryAuthority": "— to be added —",
  "legal.tbd.dataProtectionContact": "— to be added —",
  "legal.tbd.dataProtectionOfficer": "— to be added —",
  "legal.tbd.retention": "— to be added —",
  "legal.tbd.serverLogs": "— to be added —",
  "legal.tbd.modelProvider": "— to be added —",
  "legal.tbd.mailProvider": "— to be added —",
  "legal.tbd.hostingProvider": "— to be added —",
  "legal.tbd.thirdCountry": "— to be added —",
  "legal.tbd.version": "— to be added —",

  "legal.draftNotice.title": "Draft status",
  "legal.draftNotice.body":
    "This application is in a closed test phase and is not publicly available. The details still open will be added before publication.",
  "legal.footer.title": "Legal",
  "legal.footer.imprint": "Imprint",
  "legal.footer.privacy": "Privacy",
  "legal.back": "Back to the application",

  "legal.imprint.title": "Imprint",
  "legal.imprint.ddg": "Information pursuant to section 5 DDG (German Digital Services Act)",
  "legal.imprint.representedBy": "Represented by",
  "legal.imprint.contact": "Contact",
  "legal.imprint.contactEmail": "E-mail",
  "legal.imprint.contactPhone": "Telephone",
  "legal.imprint.register": "Register entry",
  "legal.imprint.registerNote":
    "This section is omitted entirely as long as there is no register entry. It is then deleted rather than filled with a substitute value.",
  "legal.imprint.vat": "VAT identification number",
  "legal.imprint.vatText":
    "VAT identification number pursuant to section 27a of the German VAT Act:",
  "legal.imprint.responsible": "Responsible for the content",
  "legal.imprint.supervisory": "Supervisory authority",
  "legal.imprint.supervisoryNote":
    "This section is omitted. It only applies to activities requiring official authorisation; providing knowledge management software does not require authorisation as things stand today.",
  "legal.imprint.status": "Note on the status of this offering",
  "legal.imprint.statusBody":
    "This offering is in a closed test phase and is intended exclusively for invited users. It is not directed at consumers and does not constitute a public offering.",

  "legal.privacy.title": "Privacy policy",
  "legal.privacy.label.purpose": "Purpose",
  "legal.privacy.label.basis": "Legal basis",
  "legal.privacy.label.retention": "Retention period",
  "legal.privacy.label.recipient": "Recipient",
  "legal.privacy.s1.title": "1. Controller",
  "legal.privacy.s1.body":
    "The controller for the processing of personal data within the meaning of the General Data Protection Regulation is:",
  "legal.privacy.s1.dpo": "Data protection officer:",
  "legal.privacy.s2.title": "2. Principle",
  "legal.privacy.s2.body":
    "We process personal data only as far as this is necessary to operate this application. We use no analytics, tracking or advertising services, load no content from third-party servers into your browser and use no tracking pixels. Our server's security policy technically prevents your browser from connecting to third-party providers.",
  "legal.privacy.s3.title": "3. User account and sign-in",
  "legal.privacy.s3.body":
    "To use the application you need an account. In doing so we process your name, your e-mail address and your password. The password is stored exclusively in a form that cannot be reversed.",
  "legal.privacy.s3.purpose": "Providing access, attributing your contributions, securing access.",
  "legal.privacy.s3.basis":
    "Performance of the contract or user relationship, Article 6(1)(b) GDPR.",
  "legal.privacy.s3.retention": "For the duration of the user relationship.",
  "legal.privacy.s3.reset":
    "If you reset your password, we create a one-time identifier that is valid for one hour and then expires.",
  "legal.privacy.s4.title": "4. Storage on your device",
  "legal.privacy.s4.p1":
    "When you sign in we set one cookie named kw_session. It contains only a random identifier, no information about you. It cannot be read by scripts in the browser, is transmitted only over an encrypted connection, is valid for fourteen days and is deleted when you sign out. On our server only a check value is stored, not the identifier itself.",
  "legal.privacy.s4.p2":
    "Without this cookie, signed-in use is technically impossible. It is therefore strictly necessary for the service you have expressly requested; no consent is required for it under section 25(2) TDDDG.",
  "legal.privacy.s4.p3":
    "If you sign in through your organisation's sign-in procedure, we set three further identifiers for the duration of that process; they are valid for ten minutes and are deleted immediately afterwards.",
  "legal.privacy.s4.p4":
    "In addition, the application remembers your view settings in your browser — for example sorting, selected filters, saved views, the chosen appearance and which introductory hints you have already seen. This information does not leave your browser and is not transmitted to us. It is only created once you use the function concerned. The application also works fully if your browser prevents this storage.",
  "legal.privacy.s4.p5":
    "One note that may matter to you: if you capture content while there is no connection to our server, the application keeps these drafts in your browser until they can be transmitted. This intermediate storage can therefore contain content written by you. It is removed there after transmission.",
  "legal.privacy.s4.p6":
    "If you use the application as an installed app, your browser stores program files in a cache so that it starts faster. Responses from our server and your content are not stored there.",
  "legal.privacy.s4.p7":
    "If ending your session fails, the application notes this in your browser under the name kw_signout_pending so that use stays blocked until our server has confirmed the session was ended. Because your session applies to every window and tab of the same browser, this marker is kept in persistent browser storage and takes effect in every window and tab as well — otherwise a second window that was already open would keep showing content even though the sign-out is still unresolved. The marker contains no information about you and is not transmitted to us. It stays until our server confirms the session was ended, or until it is established that your session no longer exists; then it is deleted. It does not expire on its own. So that this does not rest on you, the application retries ending the session by itself — as soon as your connection is back and whenever the application is opened again; you can also trigger it yourself at any time. It is technically necessary for the sign-out you requested.",
  "legal.privacy.s4.p8":
    "On the “Ask” page, the application keeps your unsent draft and the question and answer you last saw, including their source references, in your browser so that you can continue after leaving the page, reloading or signing in again. The entry is tied to your user account; anyone who signs in with a different account in the same browser is not shown it. It may contain content from your organisation’s knowledge base and remains stored in this browser after you sign out. A discarded draft is removed immediately; the displayed answer is replaced as soon as you ask a new question. The entry itself is not transmitted to us; you can delete it at any time by clearing this application’s site data in your browser.",
  "legal.privacy.s5.title": "5. Your content",
  "legal.privacy.s5.body":
    "The application serves to capture, review and retrieve knowledge. The content you enter or upload is stored together with the time and your identifier as author, so that contributions remain traceable and questions can be asked.",
  "legal.privacy.s5.basis": "Performance of the contract, Article 6(1)(b) GDPR.",
  "legal.privacy.s6.title": "6. Traceability of changes",
  "legal.privacy.s6.body":
    "To keep changes to reviewed knowledge traceable, we keep a continuous log secured against subsequent alteration. It contains the time, the identifier of the acting person, the type of action and the object concerned. IP address and browser identifier are not stored in this log. Sign-in and sign-out are recorded in the same way.",
  "legal.privacy.s6.basis":
    "Legitimate interest in the integrity and traceability of reviewed knowledge, Article 6(1)(f) GDPR.",
  "legal.privacy.s7.title": "7. Protection against misuse",
  "legal.privacy.s7.body":
    "To fend off automated sign-in attempts, we briefly count failed attempts in memory, related to the IP address and the e-mail address entered. These counters are not stored permanently.",
  "legal.privacy.s7.basis":
    "Legitimate interest in the security of the application, Article 6(1)(f) GDPR.",
  "legal.privacy.s7.logs": "Web server operating logs:",
  "legal.privacy.s8.title": "8. Artificial intelligence",
  "legal.privacy.s8.p1":
    "Certain functions of the application use an AI model — for example answering questions, structuring notes, suggesting image descriptions and grouping imported content. For such a result to come about, the content required for it is transmitted to the model's operator and processed there.",
  "legal.privacy.s8.p2":
    "At every place concerned, the application shows you that an AI model is working and what kind of model it is. Results from an AI model can be incorrect and do not replace professional review.",
  "legal.privacy.s8.p3":
    "Knowledge objects classified as confidential or strictly confidential are removed from the context before a question goes to a model — they do not reach the model. The text of your question, however, is transmitted: please do not enter confidential content there.",
  "legal.privacy.s8.thirdCountry": "Transfer to a third country:",
  "legal.privacy.s9.title": "9. Sending e-mail",
  "legal.privacy.s9.body": "We send e-mails for invitations and password resets.",
  "legal.privacy.s9.basis": "Performance of the contract, Article 6(1)(b) GDPR.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "The application runs on rented servers.",
  "legal.privacy.s10.basis": "Legitimate interest in economical operation, Article 6(1)(f) GDPR.",
  "legal.privacy.s11.title": "11. Connecting further systems",
  "legal.privacy.s11.body":
    "If your organisation sets up an import from a system of its own, the content required for it is retrieved from there. Your organisation decides which systems those are.",
  "legal.privacy.s12.title": "12. No automated decision in individual cases",
  "legal.privacy.s12.body":
    "There is no automated decision-making, including profiling, that produces legal effects concerning you or similarly significantly affects you. Suggestions from the AI model are suggestions; people decide on the admission and review of knowledge.",
  "legal.privacy.s13.title": "13. Your rights",
  "legal.privacy.s13.body":
    "You have the right to information about the data stored about you, to rectification of incorrect data, to erasure, to restriction of processing, to data portability and to object to processing based on a legitimate interest. If you have given consent, you may withdraw it at any time with effect for the future; the lawfulness of processing carried out until then remains unaffected.",
  "legal.privacy.s13.contact": "Contact for all these matters:",
  "legal.privacy.s13.authority":
    "Independently of this, you have the right to lodge a complaint with a data protection supervisory authority, in particular with the authority of your place of residence or the authority responsible for us:",
  "legal.privacy.s14.title": "14. Necessity of the information",
  "legal.privacy.s14.body":
    "Providing name, e-mail address and password is necessary to set up access. Without this information we cannot provide access. There is no statutory obligation to provide it.",
  "legal.privacy.s15.title": "15. Changes",
  "legal.privacy.s15.body":
    "We adapt this statement when the application or the legal situation changes. Version date:",

  // JOB 3761: derselbe eine Schlüssel, s. die deutsche Fassung.
  "demo.kennzeichen": "Demo instance",
  "notice.banner.aria": "Note on using this application",
  "notice.banner.title": "Briefly, for your information",
  "notice.banner.ai":
    "This application works with artificial intelligence. When you ask a question, have notes structured or have an image description suggested, an AI model is used, and the content required for it is transmitted to its operator. Results from an AI model can be incorrect and do not replace professional review. At every place concerned you can see which model is working.",
  "notice.banner.cookie":
    "A technically necessary session cookie is set for signing in. Without this cookie, signed-in use is not possible.",
  "notice.banner.ack": "Understood — continue",
  "notice.banner.decline": "I do not agree",
  "notice.decline.title": "Your session will be ended",
  "notice.decline.body":
    "The session cookie is already set — without it, signed-in use is technically impossible. We are therefore ending your session now and deleting the cookie. You can sign in again at any time.",
  "notice.decline.confirm": "End session now",
  "notice.decline.cancel": "Back to the notice",
  "notice.decline.loginHint":
    "Your session was ended because you did not agree with the notice. You can sign in again at any time.",

  "notice.signOutFailed.title": "Your session was not confirmed as ended",
  "notice.signOutFailed.body":
    "You did not agree with the notice and we tried to end your session — but the server did not confirm it. Your session may still be active. Until that is clear, we are not showing you any content, in every window and tab of this browser. The application retries ending the session by itself — as soon as your connection is back and whenever the application is opened again; you can also try again right away.",
  "notice.signOutFailed.retry": "Try ending the session again",
  "notice.signOutFailed.again":
    "This attempt did not get through either. Please check your network connection.",

  "ai.generatedNotice": "Generated by artificial intelligence — please review professionally.",
  "ai.surfaceNotice": "An AI may assist here — content it generates is labelled.",
  "ergebnisStufe.entwurf": "Reasoner draft, not validated",
  "ergebnisStufe.empfehlung": "Recommendation, unchecked",
  "ergebnisStufe.validiert": "Validated",
  "ai.costHint": "One click may trigger a real, chargeable cloud AI request.",
  "ai.exportNotice":
    "Generated by artificial intelligence (KLARWERK, {{task}}, {{date}}). To be reviewed for content.",
  "ai.task.answer": "question answered",

  "w2.result.heading": "Import result",
  "w2.run.heading": "Run",
  "w2.run.start": "Start import",
  "w2.run.idle":
    "No full run was started in this window. The start button creates one; its state then appears here. An import via “Import selection” is recorded too, but appears in the “Last successfully completed import” line above rather than here.",
  "w2.run.progress": "{{verarbeitet}} of {{gesamt}} items processed",
  "w2.run.status.QUEUED": "Queued",
  "w2.run.status.FETCHING": "Fetching the source",
  "w2.run.status.PERSISTING_SOURCE": "Storing the original",
  "w2.run.status.EXTRACTING": "Extracting statements",
  "w2.run.status.CREATING_KNOWLEDGE": "Creating knowledge units",
  "w2.run.status.ANALYZING": "Analysis running",
  "w2.run.status.COMPLETED": "Completed",
  "w2.run.status.PARTIAL": "Partially failed",
  "w2.run.status.FAILED": "Failed",
  "w2.run.status.unknown": "State unknown",
  "w2.run.hint.QUEUED": "The run has not started yet. There is no result yet.",
  "w2.run.hint.FETCHING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.PERSISTING_SOURCE": "The run is under way. What you see is an interim state.",
  "w2.run.hint.EXTRACTING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.CREATING_KNOWLEDGE": "The run is under way. What you see is an interim state.",
  "w2.run.hint.ANALYZING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.COMPLETED": "The run went through completely.",
  "w2.run.hint.PARTIAL":
    "Part of the run failed. What you see is incomplete — it is not a finished import.",
  "w2.run.hint.FAILED": "The run failed. What you see below is therefore not the intended result.",
  "w2.run.hint.unknown":
    "The server reported a state this build does not know. What you see must not be read as finished.",
  "w2.run.failureCode": "Error code",
  "w2.run.failureReason": "Reason",
  "w2.run.gesperrt.disabled":
    "The Confluence import is switched off in this installation, so no run can be started here. It is switched on on the server (see Access above).",
  "w2.run.gesperrt.noCredentials":
    "The Confluence import is switched on, but the credentials are incomplete or unusable. A run can only be started once they are in place (see Access above).",
  "w2.run.startFehler.zeitlimit":
    "Confluence did not respond in time (timeout). Please try again later.",
  "w2.run.startFehler.nichtKonfiguriert":
    "The import is not ready to start: the Confluence credentials are missing or unusable.",
  "w2.run.startFehler.ausgeschaltet":
    "The Confluence import is switched off in this installation — starting is not available.",
  "w2.run.startFehler.keinRecht": "You do not have permission to start an import.",
  "w2.run.startFehler.betreiberAus":
    "The Confluence import has been switched off by the operator — switch it on above under Access.",
  "w2.run.gesperrt.switchedOff":
    "The Confluence import has been switched off by the operator. Switch it on above under Access.",
  "w2.run.failureText.CONFLUENCE_TIMEOUT":
    "Confluence did not respond in time (timeout). The run was stopped; you can start it again.",
  "w2.run.failureText.CONFLUENCE_BUDGET":
    "The time budget for reading the space ran out. The space was not read completely.",
  "w2.run.failureText.CONFLUENCE_RESPONSE_TOO_LARGE":
    "A response from Confluence was too large and was not read.",
  "w2.run.failureText.IMPORT_UNAVAILABLE":
    "The import was not ready to start: the Confluence credentials are missing or unusable.",
  "w2.source.heading": "Original",
  "w2.source.lead": "The imported document in exactly the revision the knowledge came from.",
  "w2.source.missing": "No original was delivered for this run.",
  "w2.source.missingRequired": "Mandatory details are missing for this original.",
  "w2.source.title": "Title",
  "w2.source.system": "System",
  "w2.source.version": "Version",
  "w2.source.url": "Address",
  "w2.source.importedAt": "Imported on",
  "w2.source.externalId": "Identifier in the source system",
  "w2.knowledge.heading": "Knowledge units",
  "w2.knowledge.lead": "Independent units created from this one original.",
  "w2.knowledge.count": "{{count}} units",
  "w2.knowledge.empty": "This run produced no knowledge unit. That is not a successful import.",
  "w2.item.position": "Unit {{position}}",
  "w2.item.statementMissing": "No statement was delivered for this unit.",
  "w2.item.locator": "Location in the source",
  "w2.item.locatorMissing": "Location missing",
  "w2.item.status": "Validation",
  "w2.item.statusMissing": "Validation status missing",
  "w2.item.conflicts": "Conflicts: {{count}}",
  "w2.item.conflictsNone": "No conflicts reported",
  "w2.item.gaps": "Knowledge gaps: {{count}}",
  "w2.item.gapsNone": "No knowledge gaps reported",
  // AUFTRAG-81: mirror of the DE keys — see the note there.
  "w2.value.missing": "Required value missing",
  "w2.value.none": "Not delivered",
  // JOB 3511 — demo appearance (company CI); mirror of the DE keys.
  "einst.marke.titel": "Demo appearance",
  "einst.marke.erklaerung":
    "The choice applies to every user of this installation and is independent of the demo data packages. Switching loads no data, deletes no data and starts no AI processing.",
  "einst.marke.profil": "Company profile",
  "einst.marke.profilKeines": "No company profile",
  "einst.marke.profilAdvisor": "Advisor",
  "einst.marke.schalter": "Use company CI",
  "einst.marke.ohneProfil": "Without a company profile there is nothing to use.",
  "einst.marke.gespeichert": "Appearance applied.",
  // JOB 3742 — page help for the six quiet surfaces; mirror of the DE keys (see the note there).
  "seitenhilfe.wissensnetz.titel": "Pick a topic and look at its objects",
  "seitenhilfe.wissensnetz.text":
    "Pick a topic: next to it you see which knowledge objects belong to it, and one link opens all of them in the library. If the window is too narrow for the drawing, the same information is given in sentences. Next step: pick a topic and open one of the objects listed.",
  "seitenhilfe.profil.titel": "Language, password and signing out",
  "seitenhilfe.profil.text":
    "This is where your name, your e-mail address and your role are shown. You can switch the language of the interface, change your password, look at your own contributions and sign out. Next step: click the row you want to change — the language you switch right in its own row.",
  "seitenhilfe.kapital.titel": "Reading the holdings as figures",
  "seitenhilfe.kapital.text":
    "This page sums up how much knowledge there is, how much of it has been checked and what is still open — plus an estimate of what that is worth. You enter the assumptions behind that estimate yourself. Next step: change one assumption and read off how the estimate moves with it.",
  "seitenhilfe.graph.titel": "Jump from a dot to the knowledge object",
  "seitenhilfe.graph.text":
    "Every dot is a knowledge object; a grey line means that two of them carry the same tag, a red dashed line stands for a reported contradiction. Next step: click a dot — if it belongs to an object in the holdings, it takes you there.",
  "seitenhilfe.import.titel": "Bring knowledge in from outside and check it",
  "seitenhilfe.import.text":
    "This is where you bring knowledge in from other systems: choose a JSON file or drag it onto the area; with the necessary permission a Confluence import can be started as well. Every contribution lands in the review list as a proposal, with full text and source. Next step: read a proposal and accept it, reject it or ask a question.",
  "seitenhilfe.output.titel": "Produce a document from checked knowledge",
  "seitenhilfe.output.text":
    "Choose the kind of document, tick the knowledge objects that belong in it and put them into the order they should appear in. The document produced can be copied or downloaded as a Markdown file; below it you see which objects it came from. Next step: choose a kind and tick the first source.",
  // JOB 3670 — page help for the four administration surfaces; mirror of the DE keys. The three
  // checked facts behind these texts are documented at the DE block: admin-only route, the theme
  // bar moves above the content when narrow, and a missing area is caused by stage 2, not by role.
  "seitenhilfe.admin.uebersicht.titel": "Administration — what you set here",
  "seitenhilfe.admin.uebersicht.text":
    "Seven themes: users and roles, AI, sources and data, demo and sample data, security and evidence, reports and analysis, system. Every row names its current value on the right; a click opens the card behind it, and theme and card then live in the address — a bookmark or a reload lands right back here. On narrow windows the theme bar sits above the content instead of to its left. Where an area says “Module off”, your role is not the reason: the “Advanced modules” switch under System is. To prepare a demo account, start at users and roles, then load the demo data under demo and sample data.",
  "seitenhilfe.admin.nutzer.titel": "Managing one account",
  "seitenhilfe.admin.nutzer.text":
    "This single account is yours to handle here: while it is still waiting for approval you get the approve button, once approved the role selector instead. Plus a new password and deletion. A new password ends every open session of that person — they have to sign in again afterwards. The server protects the last approved administrator: it refuses both demotion and deletion, so nobody can lock themselves out. What a role is allowed to do at all is shown in its own card under “Users and roles”.",
  "seitenhilfe.admin.nutzerNeu.titel": "Creating an account",
  "seitenhilfe.admin.nutzerNeu.text":
    "Name, e-mail, a password of at least eight characters with a repeat field against typos, and the role. An account created here is approved immediately and can sign in — unlike one that registered itself and waits for your approval. If something is missing, clicking “Create” names the missing fields; the button is never silently greyed out. Afterwards the account appears in the list under “Users and roles”.",
  "seitenhilfe.admin.ansichtRolle.titel": "View as role",
  "seitenhilfe.admin.ansichtRolle.text":
    "You see the interface the way another role sees it; your real permissions on the server stay administrator. The consequence nobody expects: administration is visible to administrators only. Pick another role here and it disappears in the same instant, taking this card with it. That is why the way back is not this card but “Back to admin view” in the gear menu.",
  "seitenhilfe.admin.rolle.titel": "What this role may do",
  "seitenhilfe.admin.rolle.text":
    "Information, not a switch: at the top this role's freedoms in words, below them the areas its role unlocks, grouped. A “·2” marks an area that additionally needs the “Advanced modules” switch under System — without it the area stays invisible even when the role would suffice. You do not change a person's role here but in their account under “Users and roles”.",
  "seitenhilfe.admin.demo.titel": "Loading and removing demo data",
  "seitenhilfe.admin.demo.text":
    "Two buttons, two different stocks: “Load demo data” creates the general demo stock, the package button below it loads exactly the named demo package. If the general run creates new accounts, their one-time passwords appear here exactly once — a reload loses them, the server will not name them a second time. “Remove all demo data” clears both at once, including the package's building blocks. The demo appearance at the very bottom only switches logo and colours, for every user of this installation; it loads and deletes no data.",
  "seitenhilfe.admin.werk.titel": "Factory reset",
  "seitenhilfe.admin.werk.text":
    "The factory reset deletes all data and then shuts the server down; the application has to be restarted by hand. Hence two stages: first your own password, then the explicit warning. It does not exist in every installation — if this card says “Not available in this installation”, the path is not built into this server, and no switch changes that. Demo data alone is what you remove under demo and sample data instead.",
  "seitenhilfe.admin.papierkorb.titel": "Recycle bin",
  "seitenhilfe.admin.papierkorb.text":
    "Deleted knowledge objects rest here. Each entry names the person who deleted it, the date and the number of days left. “Restore” brings the object back into the library; “Delete permanently” asks once and cannot be undone afterwards. If you do nothing, the server removes the entry by itself once the deadline passes — at the next cleanup run, not to the minute.",
  "seitenhilfe.admin.audit.titel": "User changes",
  "seitenhilfe.admin.audit.text":
    "Pure information without controls: the most recent entries about accounts and sign-in, each line with time, action and the identifier of whoever acted. Nothing can be changed or deleted here — the list is the result of what was done elsewhere. The complete hash-chained trail including its verify button lives under “Security and evidence” in the audit trail.",
  "seitenhilfe.admin.protokoll.titel": "Audit trail",
  "seitenhilfe.admin.protokoll.text":
    "The hash-chained trail of this installation, shown here with its most recent entries in plain words: event, performed by, affected. “Verify chain” really recomputes the chaining and reports one of three outcomes — confirmed, unbroken but not recomputable, or not confirmed; “Print” outputs exactly this extract. Where an identifier stands instead of a name, the line next to it says why — and the reasons mean different things: “Account no longer exists” is a statement about the account, and it is only made after a fully loaded directory in which the identifier is absent. “Loading name” and “Name unavailable” say nothing about the account, only about the retrieval. Next to an affected object the identifier stands with no addition at all: nothing is looked up in the account directory there.",
  "seitenhilfe.admin.datenschutz.titel": "Privacy and security",
  "seitenhilfe.admin.datenschutz.text":
    "A list of the properties this installation really has — no promise and no switch; there is nothing to set here. The box at the foot explicitly separates measured values from target and example values, so that nobody mistakes one for the other in a conversation. “Print” outputs the list as an extract, for a question from legal for instance.",
  "seitenhilfe.admin.bereitschaft.titel": "Readiness",
  "seitenhilfe.admin.bereitschaft.text":
    "The checklist before a demo: AI, validated objects, open reviews, upload limits, external research and demo data — one indicator per row, built from real numbers. It sets nothing; it reads six sources and says what is missing. If one of them fails, you get “not retrievable” with a button that refetches all six instead of a guessed zero. The “Demo data” row leads straight to the card where you load it.",
  // JOB 4025 — page help for the backup card.
  "seitenhilfe.admin.sicherung.titel": "Backup",
  "seitenhilfe.admin.sicherung.text":
    "The information about this installation's backup directory: which dumps are there, when they were created, how large they are and whether the checksum file written by the backup script sits next to them. Information only — nothing is started, deleted or downloaded here. If the directory is missing or not readable, you read “cannot be determined” with the reason; that is explicitly something other than “no backup”. And even a full list says nothing about whether it can be restored: only the restore drill checks that.",
  // JOB 3786 — page help for the phone surface (/mobile); mirror of the DE keys. The three checked
  // facts behind this text are documented at the DE block: the route carries no role guard but the
  // three tabs need different permissions (drafts `ko.create`, ask and search `ko.read`), the
  // surface has only three tabs inside a 340 px phone frame plus the exit above it, and offline
  // only draft saves are queued — ask and search report the missing connection.
  "seitenhilfe.mobil.titel": "Capture, ask and look things up while you are out",
  "seitenhilfe.mobil.text":
    "This surface shows KLARWERK at phone width and has three tabs: “Capture” turns a title and a text into a draft — that needs the permission to create, a viewer can only read here; “Ask” and “Search” are open to every role and lead from an answer or a hit into the knowledge object. Without a connection only saving a draft is held back and sent on later; ask and search then tell you that they need a connection. Reviewing, releasing, resolving contradictions and text formatting with images and tables are NOT available here — a resumed draft shows its fixed blocks only as numbered placeholders. Next step: tap one of the tabs; for everything else “To full version” at the top takes you back to the big window.",
  // JOB 3863: die Seitenhilfe der KI-Freigabe. Belege je Zusage stehen im deutschen Block.
  "seitenhilfe.admin.kiFreigabe.titel": "The two switches of the AI clearance",
  "seitenhilfe.admin.kiFreigabe.text":
    "Two switches, and the second one depends on the first. “Allow public AI” is the basic clearance: only it lets any text go to an external provider at all, and only an explicit yes counts — “not set” blocks just as much as no. “Also send confidential content to the public AI” extends it to text classified as confidential; without the basic clearance this second switch has no effect, and the card says so underneath it. Before you switch it on the screen asks once, explicitly, because confidential text then goes to the external provider; taking it back leads in the safe direction and asks nothing. Only an administrator may switch. An extension is granted only if it can also be logged — otherwise the server refuses it instead of granting it silently. A withdrawal needs no record in advance: if logging fails after a withdrawal has gone through, the withdrawal still takes effect. If the withdrawal cannot be saved at all, the server reports the error and the state stored so far continues to apply. What applies is in the line below the switches: it shows the state confirmed by the server, not the box you just ticked.",
  "seitenhilfe.admin.kiOhneFreigabe.titel": "As long as nothing is cleared",
  "seitenhilfe.admin.kiOhneFreigabe.text":
    "On the web surface it depends on whether your own internal model is connected. If one is connected, it carries the work on, and the AI buttons stay usable. If only the public AI is set up, it drops out of the chain without clearance and no model is left for the task: the AI buttons are then greyed out and carry the sentence “AI unavailable — no model is active for this task.” No silent substitute run fakes a model. Klara in the Word pane does not even take the external route: it reports the block as an incompletely stored rule, and no user consent lifts it — nobody can click away a decision of the administrator. If the AI mapping is fixed by the deployment configuration (KLARWERK_REASONER_POLICY), these two switches have no effect either: they are locked, the server would refuse a save, and because the deployment mapping carries no clearance of its own, public AI stays blocked for as long as it applies. The next step then does not run through this card but through the server's deployment configuration; without the variable the choice stored here applies again.",
  // JOB 4154 (WIKI-GESAMTANWEISUNG): mirror of the DE keys. „unchanged" stays „unchanged" — it is
  // never „correct", „checked" or „approved".
  "ga.titel": "Work instruction",
  "ga.laedt": "Loading …",
  "ga.leer":
    "This work instruction has no sections yet. Add the first one from existing knowledge above.",
  "ga.fehler": "The work instruction could not be loaded. Reload the page or try again later.",
  "ga.ablageFluechtig":
    "This installation cannot store instructions permanently. Nothing was created — please contact your system administrator.",
  "ga.offline": "No connection. Your entries are kept; nothing has been saved.",
  "ga.standVon": "State as of {{zeit}}",
  "ga.auffrischungLaeuft": "State as of {{zeit}} · refreshing",
  "ga.auffrischungGescheitert": "State as of {{zeit}} · refresh failed",
  "ga.gesperrt": "Submitting and deciding are blocked: the state shown is not confirmed.",
  "ga.unvollstaendig": "Parts of this work instruction are not accessible to you.",
  "ga.verborgene": "Inaccessible sections: {{anzahl}}",
  "ga.pruefanbindung":
    "Check integration: not connected yet – no automatic expert review of this instruction takes place.",
  "ga.stand.entwurf": "Draft",
  "ga.stand.vorgelegt": "Submitted",
  "ga.stand.entschieden": "Approved",
  "ga.stand.abgelehnt": "Rejected",
  "ga.bausteine": "Sections",
  "ga.baustein.fassung": "Bound version {{version}}",
  "ga.baustein.herkunft": "{{titel}} · {{autor}}",
  "ga.baustein.herkunftUnbekannt": "The bound version cannot be found.",
  "ga.baustein.fassungAmUnbekannt": "Version date unknown",
  "ga.baustein.aktualisierung":
    "A newer version exists ({{version}}). The bound version stays in place.",
  "ga.baustein.nachweisFehlt": "There is no record for this version.",
  "ga.baustein.tabellen": "Table headings: {{werte}}",
  "ga.baustein.abbildungen": "Figures: {{werte}}",
  "ga.baustein.unbekannt": "not determinable",
  "ga.baustein.keine": "none",
  "ga.baustein.textUnbelegt": "The content of this version is not on record.",
  "ga.baustein.gliederung": "Outline of this version",
  "ga.aufnahme.titel": "Add a section from existing knowledge",
  "ga.aufnahme.koId": "Entry",
  "ga.aufnahme.koVersion": "Version",
  "ga.aufnahme.nachweis": "Record (optional)",
  "ga.aufnahme.knopf": "Add",
  "ga.aufnahme.fassungUnbekannt":
    "This version does not exist (any more). Choose one of the versions shown.",
  "ga.ordnen.hoch": "Move up",
  "ga.ordnen.runter": "Move down",
  "ga.voraussetzung.label": "Precondition",
  "ga.voraussetzung.knopf": "Apply precondition",
  "ga.vergleich.titel": "What has changed?",
  "ga.vergleich.von": "Older state",
  "ga.vergleich.bis": "Newer state",
  "ga.vergleich.knopf": "Compare",
  "ga.vergleich.unveraendert": "Unchanged. That is no statement about correctness.",
  "ga.vergleich.geaendert": "Changed.",
  "ga.vergleich.unbekannt": "Effect not determinable — needs expert clarification.",
  "ga.vergleich.unbekannte": "Findings that could not be determined: {{anzahl}}",
  "ga.vergleich.keineAussage": "No comparison possible — no equality is claimed.",
  "ga.feld.kopf": "Title and purpose",
  "ga.feld.geltung": "Scope",
  "ga.feld.voraussetzungen": "Preconditions",
  "ga.feld.bausteinbestand": "Set of building blocks",
  "ga.feld.reihenfolge": "Order",
  "ga.feld.fassung": "Bound version",
  "ga.feld.tabellenueberschriften": "Table headings",
  "ga.feld.abbildungen": "Figures",
  "ga.entscheidung.titel": "Submit for decision",
  "ga.entscheidung.vorlegen": "Submit",
  "ga.entscheidung.annehmen": "Accept",
  "ga.entscheidung.ablehnen": "Reject",
  "ga.entscheidung.konflikt":
    "The work instruction has changed in the meantime. Please reload the page and try again.",
  "ga.kopf.titel": "Title",
  "ga.kopf.zweck": "Purpose",
  "ga.kopf.geltungsbereich": "Scope",
  "ga.kopf.voraussetzungen": "Preconditions",
  "ga.bereich.titel": "Work instructions",
  "ga.bereich.einleitung":
    "Assemble existing knowledge into a readable step-by-step instruction – for example for onboarding new colleagues.",
  "ga.bereich.anlegen": "Create new work instruction",
  // JOB 4357 — the stored inventory. „Nothing stored" and „could not look" are two different
  // statements and never share a sentence (see the DE block for the reasoning).
  "ga.liste.titel": "Existing work instructions",
  "ga.liste.laedt": "Loading the existing work instructions …",
  "ga.liste.fehler":
    "The existing work instructions could not be loaded. Reload the page or try again later – you can still create a new instruction.",
  "ga.liste.leer":
    "There is no work instruction yet. Create your first one below – it will then appear here.",
  "ga.liste.stand": "Status",
  "ga.liste.urheber": "Created by",
  "ga.liste.geaendert": "Last changed",
  "ga.liste.bausteine": "Sections: {{anzahl}}",
  "ga.liste.unvollstaendig": "Incomplete for you – sections you cannot access: {{anzahl}}",
};

export { en };
