import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  type CaptureService,
  type Draft,
  type DraftPayload,
  validateDraftPayloadShape,
} from "../../../capture";
import {
  type KoService,
  alsMenge,
  alsSchreibpatch,
  createOperationFingerprint,
} from "../../../knowledge-object";
import type { ValidationService } from "../../../validation";
import type { AiCheckWorker } from "../ai-check-worker";
import { type SemanticPrefilter, indexKoForDuplicatePrefilter } from "../duplicate-detection";
import { type Guards, type SessionUser, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

// AUFTRAG-mega19 Block B: EXPORTIERT, damit die Composition-Root den Entwurfs-Zugang der
// Dokumentübernahme (ko-routes, `DraftPromotionSource`) aus DERSELBEN Regel bildet. Zwei
// Auffassungen davon, wer einen Entwurf sehen darf, wären eine zu viel.
export function canSeeDraft(user: SessionUser, draft: Draft): boolean {
  return user.role === "admin" || draft.originalAuthor === user.id;
}

function visibleDraftsFor(user: SessionUser, drafts: Draft[]): Draft[] {
  return user.role === "admin"
    ? drafts
    : drafts.filter((draft) => draft.originalAuthor === user.id);
}

async function requireVisibleDraft(
  capture: CaptureService,
  id: string,
  user: SessionUser,
  reply: FastifyReply,
): Promise<Draft | undefined> {
  const draft = await capture.getDraft(id);
  if (!draft) {
    reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
    return undefined;
  }
  if (!canSeeDraft(user, draft)) {
    reply.code(403).send({ error: "FORBIDDEN", message: "Entwurf nicht verfuegbar." });
    return undefined;
  }
  return draft;
}

// WP-D1d (Pedi-Entscheid): expliziter bodyLimit für die Draft-schreibenden Routen (POST/PUT
// /api/drafts). Ceiling = 5 MiB — bewusst KLEIN (kleine Pre-Auth-Parser-Fläche; später erhöhbar),
// aber deutlich über dem 1-MiB-Default, damit ein Dokument-Import mit VIELEN clientseitig komprimierten
// Bildern durchgeht. Über dem Cap: kontrolliertes 413. bens ROT-Fix 3: die vergrößerte Parser-Fläche
// ist zusätzlich durch einen AUTH-Guard VOR dem Body-Parsing abgesichert (onRequest, s.
// requireAuthedBeforeParse) — ein anonymer Request wird mit 401 abgewiesen, BEVOR bis zu 5 MiB Body
// gelesen/geparst werden. 5 MiB ist ohnehin eine kleine Fläche; die Abwägung ist bewusst konservativ.
export const DRAFTS_BODY_LIMIT = 5 * 1024 * 1024; // 5 MiB

// JOB 511 (schliesst den SERVERANTEIL von R5 aus JOB 506) — DIE ABLEHNUNG SAGT, WAS VERLOREN GING.
//
// Fastifys Standardantwort oberhalb des Caps lautet "Payload Too Large". Sie ist wahr und zugleich
// unbrauchbar: der Aufrufer erfaehrt NICHT, ob am Server bereits ein Entwurf entstanden ist und ob
// Bilder uebernommen wurden. Genau daran scheiterte das sichtbare Versprechen "nichts geht still
// verloren" (JOB 506, BEN-bestaetigt): aus einer generischen 413 laesst sich kein ehrlicher
// Verlustzustand bauen, die Oberflaeche muesste raten.
//
// DIE ANTWORT IST DESHALB MASCHINENLESBAR UND STABIL: eigener Fehlercode statt Fastify-Interna,
// draftCreated=false (der Body wurde nie geparst, der Handler lief nie, das Repository sah nie einen
// Create) und imageTransfer="not_completed" als ausdrueckliche Aussage ueber die Bilduebernahme. Die
// Feldmenge ist in drafts-body-limit.test.ts gepinnt: kein Rohstack, keine Groessenangabe, keine
// stille Drift.
export const DRAFT_BODY_TOO_LARGE = "DRAFT_BODY_TOO_LARGE";

const DRAFT_BODY_TOO_LARGE_MESSAGE =
  "Das Dokument ist zu gross fuer die Uebernahme. Es wurde kein Entwurf angelegt und keine Bilder wurden uebernommen. Bitte das Dokument verkleinern oder in Teilen uebernehmen.";

// Der routen-eigene Fehlerweg von POST /api/drafts — und er ist mit Absicht ENG: er greift
// AUSSCHLIESSLICH den Cap-Bruch ab (`FST_ERR_CTP_BODY_TOO_LARGE`, den Fastify wirft, wenn der Body
// DRAFTS_BODY_LIMIT reisst) und uebersetzt ihn in den oben beschriebenen Vertrag. Jeder ANDERE
// Fehler wird unveraendert an Fastifys Standardbehandlung zurueckgereicht (`reply.send(error)`):
// ein Formfehler bleibt der gewohnte 400, ein Fehler aus dem Routen-Handler bleibt das, was
// `sendError` daraus macht. Diese Enge ist der eigentliche Punkt — die Route bekommt EINE ehrliche
// 413-Antwort, keinen zweiten, abweichenden Fehlerkanal fuer alles Uebrige.
function draftBodyTooLargeErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error.code !== "FST_ERR_CTP_BODY_TOO_LARGE") {
    reply.send(error);
    return;
  }
  reply.code(413).send({
    error: DRAFT_BODY_TOO_LARGE,
    message: DRAFT_BODY_TOO_LARGE_MESSAGE,
    // Beides ist hier TATSACHE, nicht Vermutung: oberhalb des Caps bricht Fastify das Lesen des
    // Bodys ab, bevor der Routen-Handler laeuft. `capture.createDraft` wurde also nie gerufen, das
    // Repository sah keinen Create, und die Bilduebernahme hat nie begonnen.
    draftCreated: false,
    imageTransfer: "not_completed",
  });
}

// Entwürfe (§2.4 / FR-CAP). Admin sieht den gemeinsamen Pool; normale Nutzer nur eigene Entwürfe.
// Autor bleibt erhalten; Promote → KO.
export interface CaptureRoutesDeps {
  capture: CaptureService;
  ko: KoService;
  // SCRUM-395: Prüfer-Vorschlag beim Promote (Zuweisung + Benachrichtigung wie im Board).
  validation: ValidationService;
  notifyAssignment?: AssignmentNotifier;
  // Weg 3 (Feature-Flag): semantischer Vorfilter der Duplikat-Erkennung. Nur gesetzt, wenn aktiviert.
  semanticPrefilter?: SemanticPrefilter | undefined;
  // WP-SUBMIT-ASYNC (Pedis R3): die frühere synchrone Erkennung (conflicts/overlaps/reasoner-Deps)
  // ist aus dem Promote-Pfad heraus in den Hintergrund-Worker gewandert — der Worker kapselt
  // diese Abhängigkeiten jetzt selbst.
  aiCheckWorker?: AiCheckWorker | undefined;
}

export function captureRoutes(deps: CaptureRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { capture, ko, validation, notifyAssignment, semanticPrefilter, aiCheckWorker } = deps;

  // WP-D1d (bens ROT-Fix 3): AUTH VOR BODY-PARSING. Fastify parst den Body (bis DRAFTS_BODY_LIMIT) in
  // der preValidation/-Handler-Phase — VOR guards.requirePermission im Handler. Dieser onRequest-Hook
  // läuft VOR dem Parsing: ein anonymer/ungültiger Request wird sofort mit 401 abgewiesen, sodass die
  // vergrößerte Parser-Fläche nicht für eine anonyme Flut offensteht. Der Handler prüft danach zusätzlich
  // die konkrete Berechtigung (ko.create) — Defense-in-Depth.
  const requireAuthedBeforeParse = async (
    request: Parameters<Guards["requireUser"]>[0],
    reply: Parameters<Guards["requireUser"]>[1],
  ): Promise<void> => {
    // requireUser sendet bei fehlender/ungültiger Session 401. Fastify stoppt den Lifecycle dann anhand
    // reply.sent VOR dem Body-Parsing — die 5-MiB-Parser-Fläche steht anonym nicht offen.
    await guards.requireUser(request, reply);
  };

  return async (app) => {
    app.get("/api/drafts", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega20 Block D: die LISTE ist der echte Fortsetzen-Weg (CaptureDraftList →
      // onResume arbeitet mit dem Objekt aus dieser Antwort, nicht mit einem zweiten GET). Sie
      // läuft deshalb durch DIESELBE Ankerprüfung wie die Einzelroute — sonst stünde „kein
      // Body-Resume ohne Anker" im Code und griffe in der Anwendung nie.
      const geprueft = await capture.listDraftsForResume();
      reply.code(200).send(
        visibleDraftsFor(
          user,
          geprueft.map((eintrag) => eintrag.draft),
        ).map((draft) => {
          const fehlend = geprueft.find((e) => e.draft.id === draft.id)?.anchorsMissing ?? [];
          return fehlend.length > 0 ? { ...draft, anchorsMissing: fehlend } : draft;
        }),
      );
    });

    app.post<{ Body: DraftPayload }>(
      "/api/drafts",
      {
        bodyLimit: DRAFTS_BODY_LIMIT,
        onRequest: requireAuthedBeforeParse,
        errorHandler: draftBodyTooLargeErrorHandler,
      },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(201).send(await capture.createDraft(request.body, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const draft = await requireVisibleDraft(capture, request.params.id, user, reply);
      if (!draft) {
        return;
      }
      // AUFTRAG-mega20 Block D: DAS FORTSETZEN LÄUFT ÜBER DIE ANKERPRÜFUNG.
      //
      // `requireVisibleDraft` bleibt die SICHTBARKEITS-Entscheidung (404/403) und wird davon nicht
      // berührt. Was hier dazukommt, ist die INHALTS-Entscheidung: beruft sich der Entwurf auf ein
      // gesichertes Original, das es nicht mehr gibt, kommt sein Body NICHT zurück — sonst stünde
      // übernommener Dokumenttext ohne Herkunft im Editor und ließe sich von dort einreichen.
      // Der Aufrufer erfährt in `anchorsMissing` ausdrücklich, welche Originale fehlen; die
      // ausgeschriebene Abwägung steht in capture/src/service.ts bei `resumeDraft`.
      const fortsetzung = await capture.resumeDraft(request.params.id);
      if (!fortsetzung) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
        return;
      }
      reply
        .code(200)
        .send(
          fortsetzung.anchorsMissing.length > 0
            ? { ...fortsetzung.draft, anchorsMissing: fortsetzung.anchorsMissing }
            : fortsetzung.draft,
        );
    });

    // ============================================================================================
    // JOB 1171 D1 (KA8 Stufe 1a) — DIE AUSKUNFT UEBER DEN NAECHSTEN SINNVOLLEN SCHRITT.
    // ============================================================================================
    //
    // KEIN SICHTBARER NUTZEN. Diese Route ist der Datenlieferant, nicht die Karte. Es gibt heute
    // keinen Aufrufer: die Clientverdrahtung ist Stufe 1a-b und wartet auf die Integration von
    // JOB 1164 D1 (`apps/web/src/api/types.ts` traegt dort einen zweiten, nicht integrierten
    // Stand), die Web-Karte ist Stufe 1b, die Panel-Karte Stufe 2.
    //
    // REINE LESUNG, und das ist die Zusage: kein Schreibpfad, keine Nebenwirkung, kein neuer
    // gespeicherter Zustand. `anchorsMissing` wird ueber `verifyDraftAnchors` GELESEN, nicht
    // geaendert. Dieselbe Berechtigung und dieselbe Sichtbarkeitsentscheidung wie die uebrigen
    // Entwurfsrouten — eine zweite Auffassung davon, wer einen Entwurf sehen darf, waere eine zu
    // viel (s. `canSeeDraft` oben).
    //
    // DER LEERFALL LIEFERT EIN LEERES OBJEKT, nicht `null` und nicht einen leeren String: ist kein
    // Schritt ableitbar, FEHLT der Schluessel. Ein gesetztes Feld ohne Wert waere eine Auskunft,
    // die so aussieht, als haette jemand nachgedacht. Geprueft wird das entsprechend mit dem
    // `in`-Operator und nicht gegen `undefined`.
    app.get<{ Params: { id: string } }>(
      "/api/drafts/:id/naechster-schritt",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
        const schritt = await capture.naechsterSchrittFuerEntwurf(request.params.id);
        reply.code(200).send(schritt ? { naechsterSchritt: schritt } : {});
      },
    );

    app.put<{ Params: { id: string }; Body: DraftPayload }>(
      "/api/drafts/:id",
      // WP-D1c/WP-D1d: derselbe dokument-taugliche Cap + Auth-vor-Parsing wie POST — ein bildreicher
      // Entwurf wird auch beim Weiterbearbeiten/Speichern gesendet.
      { bodyLimit: DRAFTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
            return;
          }
          reply
            .code(200)
            .send(await capture.continueDraft(request.params.id, request.body, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
        await capture.deleteDraft(request.params.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-CAP-07: Entwurf → Wissensobjekt; Autor = Originalautor (in toKoInput gesetzt).
    // SCRUM-395: optionaler Prüfer-Vorschlag beim Einreichen — wie bei POST /api/kos
    // (dedupliziert, ohne den Einreicher selbst; Benachrichtigung über FR-VAL-07).
    // ==============================================================================================
    // AUFTRAG-mega22 Block H — DER PROMOTE-WEG ÜBERLEBT DEN ANTWORTVERLUST.
    // ==============================================================================================
    //
    // DER BEFUND. Ein Antwortverlust erzeugt hier kein Duplikat und keinen Inhaltsverlust — der
    // Entwurf ist weg, das Wissensobjekt steht. Der Nutzer sieht aber 404 für einen GELUNGENEN
    // Vorgang. Das ist derselbe Mangel, den mega21 Block B für den Dokumentweg geschlossen hat, eine
    // Tür weiter. ben stuft den Weg als Nach-VIP-2 ein, SOFERN er nicht Teil des VIP-2-Drehbuchs
    // ist. Er ist es: der manuelle Entwurfs-Promote gehört zum Rundgang.
    //
    // ES IST DERSELBE VERTRAG, NICHT EIN ZWEITER: derselbe Vorgangsschlüssel (`operationId`,
    // `OPERATION_ID_PATTERN`), derselbe Nachschlag VOR allem Veränderlichen, derselbe Eigentümer-
    // und Abdruckvergleich (`adoptCreatedKo`, drei Tore), dieselben Fehlercodes
    // (`CREATE_ANCHOR_TAKEN`, `CREATE_REPAIR_REQUIRED`, `IDEMPOTENCY_PAYLOAD_MISMATCH`).
    //
    // WAS NICHT ÜBERTRAGBAR WAR, einzeln benannt statt stillschweigend weggelassen:
    //
    //   1. `draftPayload` IST HIER OPTIONAL, auf dem Dokumentweg ist es Pflicht (mega22 Block C).
    //      Der Grund ist kein Nachlassen, sondern ein Unterschied im Vertrag: der Dokumentweg hat
    //      einen ZWEITEN Inhaltskanal (`create`) und musste deshalb erzwingen, dass der Abdruck
    //      überhaupt Inhalt sieht. Der Promote-Weg hat gar keinen Client-Inhaltskanal — sein Inhalt
    //      IST der adressierte Entwurf. Deshalb geht `draftId` in den Abdruck (dieselbe Antwort auf
    //      SB-D wie dort), und mitgeliefertes `draftPayload` geht zusätzlich hinein.
    //   2. ES GIBT KEINE KOMPENSIERENDE RÜCKNAHME und damit keinen `repair_required`, den DIESER
    //      Weg erzeugen könnte. `create` bleibt nach dem Insert bewusst untransaktional
    //      (WP-SHIP8-CLOSE-5); ein Zustand `repair_required` kann hier also nur von einem Objekt
    //      stammen, das der Dokumentweg hinterlassen hat. Das Tor wird trotzdem durchlaufen — es
    //      auszulassen hiesse, denselben Vorgang an zwei Türen verschieden zu beurteilen.
    //   3. `operationId` IST OPTIONAL, auf dem Dokumentweg ist es Pflicht. Ohne Schlüssel verhält
    //      sich die Route EXAKT wie vorher (kein Vorgang, kein Nachschlag, keine Adoption). Das ist
    //      eine bewusste Abwägung: `POST /api/drafts/:id/promote` ist ein länger bestehender
    //      öffentlicher Vertrag mit Aufrufern ausserhalb dieser Oberfläche, und ein hartes 400 für
    //      einen fehlenden Schlüssel bräche sie ohne Not. Der Preis ist benannt: wer ohne Schlüssel
    //      promotet, bekommt die alte Zusage — 404 nach Antwortverlust.
    //
    // ==============================================================================================
    // AUFTRAG-mega23 Block A — DIE KORREKTUR EINER BEHAUPTUNG, DIE HIER STAND.
    // ==============================================================================================
    //
    // AN DIESER STELLE STAND: „Die Oberfläche schickt ihn ausnahmslos (Capture.tsx,
    // CaptureFrontDoor.tsx)." FÜR DIE VORDERTÜR WAR DAS OBJEKTIV FALSCH. `CaptureFrontDoor.tsx`
    // verdrahtete `promoteDraft: (id) => endpoints.drafts.promote(id)`, und der Clientvertrag in
    // `lib/captureFrontDoor.ts` kannte nur `promoteDraft(id)` — weder Schlüssel noch Stand reisten
    // mit. Der Satz hat einen ungeprüften Zustand als geprüft aussehen lassen; das ist selbst ein
    // Befund und nicht nur der Rahmen eines Befundes.
    //
    // SEIT mega23 Block A schickt die Vordertür beides. Der Satz ist damit wahr — aber er bleibt
    // eine Behauptung ÜBER FREMDE DATEIEN, und genau daran ist er das erste Mal gescheitert. Er
    // steht deshalb nicht mehr allein hier, sondern ist GEPINNT: `tests/capture/promote-operation-
    // callers.test.ts` liest beide Aufrufstellen und schlägt fehl, sobald eine den Schlüssel
    // wieder weglässt.
    //
    // OB DER SCHLÜSSEL PFLICHT WERDEN SOLL: NEIN, nicht in dieser Runde — und der Grund ist ein
    // anderer als „es gibt noch einen Aufrufer". Auf DIESEM Weg kann ein fehlender Schlüssel
    // KEINE Dublette erzeugen: der Promote verbraucht einen ADRESSIERTEN Entwurf, und nach einem
    // gelungenen Lauf ist der weg — der Wiederholversuch scheitert an 404 statt ein zweites Objekt
    // anzulegen. Der Preis der Optionalität ist also eine unschöne Fehlermeldung, kein
    // Integritätsschaden. Auf dem Dokumentweg ist er Pflicht, weil `create` dort OHNE Entwurf
    // laufen kann und ein zweiter Lauf tatsächlich ein zweites Objekt erzeugte. Ein 400 hier
    // bräche demgegenüber jeden nicht-Oberflächen-Aufrufer dieser Route (der Bestand solcher
    // Aufrufer ist nicht inventarisiert) — acht Tage vor VIP-2, ohne Integritätsgewinn.
    app.post<{
      Params: { id: string };
      Body: {
        reviewerIds?: string[];
        operationId?: string;
        draftPayload?: DraftPayload;
      } | null;
    }>("/api/drafts/:id/promote", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        const body = request.body ?? {};
        const operationId = typeof body.operationId === "string" ? body.operationId.trim() : "";
        // ------------------------------------------------------------------------------
        // DER NACHSCHLAG STEHT VOR ALLEM VERÄNDERLICHEN — und das ist hier keine Feinheit,
        // sondern der ganze Block: `requireVisibleDraft` unten antwortet nach einem gelungenen
        // ersten Lauf mit 404, weil der Entwurf dann GELÖSCHT ist. Stünde der Nachschlag darunter,
        // liefe die Adoptionsmechanik im echten Klickpfad ins Leere — genau der Fehler, den
        // mega21 Block B auf dem Dokumentweg beseitigt hat.
        // ------------------------------------------------------------------------------
        let fingerprint = "";
        if (operationId) {
          fingerprint = createOperationFingerprint({
            // AUFTRAG-mega22 Block C, hier ebenso: der Request VERBRAUCHT diesen Entwurf. Zwei
            // Anfragen, die verschiedene Entwürfe verbrauchen, sind nicht derselbe Vorgang.
            draftId: request.params.id,
            // K8 (document-create.ts): die Schreibladung semantiktreu, `fehlt` ≠ `leer`.
            inhalt: alsSchreibpatch(body.draftPayload ?? null),
            reviewerIds: alsMenge(body.reviewerIds),
            weg: "promote",
          });
          const replay = await ko.lookupDocumentCreate(operationId, {
            actor: user.id,
            fingerprint,
          });
          if (replay) {
            // 200 statt 201: derselbe Vorgang, aber das Objekt entsteht NICHT jetzt. Keine
            // Folgeschritte — sie liefen beim ersten Mal.
            reply.code(200).send(replay);
            return;
          }
        }
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
        // AUFTRAG-mega22 Block H: liegt ein Stand bei, wird er HIER geschrieben — im selben
        // Vorgang, hinter dem Nachschlag. Damit braucht die Oberfläche kein vorgeschaltetes
        // `PUT /api/drafts/:id` mehr, das nach einem gelungenen ersten Lauf mit 404 abfinge.
        // Die Gestaltprüfung läuft am RAND (mega22 Block D) — ein Formfehler wird hier 400 und
        // entsteht nicht in der Tiefe von `continueDraft`.
        if (body.draftPayload !== undefined) {
          const gestalt = validateDraftPayloadShape(body.draftPayload);
          if (!gestalt.ok) {
            reply.code(400).send({ error: "BAD_REQUEST", message: gestalt.message });
            return;
          }
          await capture.continueDraft(request.params.id, gestalt.payload, user.id);
        }
        const input = await capture.toKoInput(request.params.id);
        // WP-RETEST7 R6: author IMMER aus einem echten Nutzer — normal der Originalautor des
        // Entwurfs (FR-CAP-07); trägt ein Altbestands-Entwurf KEINEN originalAuthor (leer),
        // wird ehrlich der EINREICHENDE Session-Nutzer gesetzt statt eines leeren author-Felds
        // (Pedis Befund: Validierungskarte ohne „von …").
        //
        // AUFTRAG-mega22 Block H: der VORGANG reist mit, wenn einer mitgeschickt wurde — und der
        // Eigentümer ist der EINREICHENDE Nutzer, nicht `input.author`. Das ist genau die Trennung
        // aus mega21 Block A: ein Admin darf einen fremden Entwurf einreichen; das Wissensobjekt
        // trägt dann den Originalautor, der VORGANG aber gehört dem Admin, der ihn gestartet hat.
        const created = await ko.create(
          { ...input, author: input.author.trim() ? input.author : user.id },
          ...(operationId
            ? ([{ id: operationId, actor: user.id, fingerprint }] as const)
            : ([] as const)),
        );
        await capture.deleteDraft(request.params.id);
        const reviewers = [...new Set(body.reviewerIds ?? [])].filter((id) => id !== user.id);
        if (reviewers.length > 0) {
          await validation.assign(created.id, reviewers, user.id);
          await notifyAssignment?.(created.id, reviewers);
        }
        // WP-SUBMIT-ASYNC (Pedis R3, 21.07.): wie beim direkten Einreichen — kein synchroner
        // detect*-Lauf mehr vor der Antwort; nur der Prüf-Job wird vermerkt und der Worker
        // arbeitet ihn danach ab (dieselben Erkennungs-Pfade, Status im Board sichtbar).
        // Wie in ko-routes: die 201-Antwort trägt den Vermerk ehrlich mit (aiCheck pending);
        // Nachlesen VOR dem enqueue → deterministischer Job-Start in der Antwort.
        let submitted = created;
        if (aiCheckWorker) {
          await ko.markAiCheckPending(created.id);
          submitted = (await ko.get(created.id)) ?? created;
          // WP-SHIP8-CLOSE-2 (bens F3): Zielversion des frischen Vermerks synchron mitgeben —
          // die Overflow-Eviction schließt hart versionsgebunden ab (kein unversionierter Write).
          aiCheckWorker.enqueue(created.id, submitted.aiCheck?.koVersion);
        }
        reply.code(201).send(submitted);
        // Weg 3 (B6): Einbettung + Ablage NACH der Antwort — der Nutzer wartet nie darauf. Flag aus
        // = No-op; Fehler brechen den (bereits gesendeten) Submit nie. await nur zur deterministischen
        // Fertigstellung der Ablage, nicht zur Client-Latenz (201 ist schon raus).
        await indexKoForDuplicatePrefilter(created, semanticPrefilter);
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
