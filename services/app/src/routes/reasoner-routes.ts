import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { CaptureService } from "../../../capture";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  publicAiEnrichmentAllowed,
} from "../../../external-search";
import { type Confidentiality, type KoService, isConfidential } from "../../../knowledge-object";
import {
  MAX_DESCRIBE_IMAGE_DATAURL_CHARS,
  type ModelRunSubject,
  type Reasoner,
  type ReasonerLocale,
  ReasonerPolicyLockedError,
  validateDescribeImageDataUrl,
} from "../../../reasoner";
import { runConflictSelfTest } from "../conflict-self-test";
import { runDuplicateSelfTest } from "../duplicate-self-test";
import type { Guards } from "../http";
import { type Ka4Freigabepruefer, ka4Freigabe, klaraBindungVorhanden } from "./ask-routes";

// FR-I18N-01: nur DE/EN; alles andere/ungültige normalisiert sauber auf "de" (keine 400).
function normalizeLocale(value: unknown): ReasonerLocale {
  return value === "en" ? "en" : "de";
}

// N11b: Nicht eingestufter draft/transient-document-Text erreicht die Cloud nur mit bestätigter
// KA4-Dokumentzustimmung; gespeicherte Vertraulichkeit und der Draft-Ankerriegel bleiben wirksam.
// koId/draftId heben ausschließlich die Stufe; source:"ko" gibt frei gelieferten Text nie frei.
export type StoredLookup = { found: boolean; level?: Confidentiality | null };

const CLIENT_TEXT_SOURCES = new Set(["draft", "transient-document"]);

export function classifyProvenanceConfidential(
  source: unknown,
  declared: unknown,
  backstop: StoredLookup,
  {
    dokumentZustimmung = false,
    nichtEingestuft,
  }: {
    dokumentZustimmung?: boolean;
    nichtEingestuft?: unknown;
  } = {},
): boolean {
  if (typeof source === "string" && CLIENT_TEXT_SOURCES.has(source)) {
    const ohneEinstufung =
      (declared !== "intern" && declared !== "vertraulich" && declared !== "streng_vertraulich") ||
      (declared === "vertraulich" && nichtEingestuft === true);
    if (ohneEinstufung) {
      return dokumentZustimmung !== true || isConfidential(backstop.level ?? null);
    }
    // Backstop hebt nur: ein gespeichert-vertrauliches KO (via koId) macht auch als "intern"
    // deklarierten Text vertraulich; ein internes/unbekanntes KO senkt nie eine Deklaration.
    return isConfidential(declared) || isConfidential(backstop.level ?? null);
  }
  // source:"ko"/plain/fehlend/ungültig → loser/kein Anker → fail-safe vertraulich.
  return true;
}

// Reasoner (§2.5): ein einheitlicher, modellagnostischer Endpunkt. 'structure' formt Rohtext
// zu einem KO-Vorschlag; 'ask' beantwortet über die Ask-Schicht (Kontext aus validierten KOs).
export interface ReasonerRoutesDeps {
  reasoner: Reasoner;
  ask: AskService;
  // SCRUM-426: Freigabe-Gate der Public-KI-Anreicherung (Admin-Regler SCRUM-414).
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-502 Schicht 2: für den autoritativen koId-Load der gespeicherten Vertraulichkeitsstufe.
  ko: KoService;
  // JOB 2692 D1 (Review-Befund 17): der autoritative draftId-Load — die im ENTWURF gespeicherte
  // Stufe ist der zweite hebende Backstop neben der koId. Nur `getDraft`, kein Schreibrecht.
  capture: Pick<CaptureService, "getDraft">;
  // JOB 2692 D1: der KA4-Riegel (Einwilligung je Dokument) aus `ask-routes.ts` — dieselbe
  // Dienstinstanz wie dort. OPTIONAL: fehlt er, verhält sich eine Klara-gebundene Anfrage
  // fail-closed (keine Cloud); eine Anfrage ohne Bindung bleibt unverändert.
  ka4?: Ka4Freigabepruefer | undefined;
}

// JOB 2692 D1: was die Route über den Aufruf weiß, das der reinen Regel fehlt — Entwurfskennung,
// handelnder Nutzer, Kopfzeilen (Klara-Bindung) und das Protokoll. Kein Inhalt reist hier mit.
type Aufrufbindung = {
  inhalt: "text" | "bild";
  nichtEingestuft?: unknown;
  draftId: unknown;
  actorId: string;
  headers: Record<string, unknown>;
  log: { info: (obj: unknown, msg: string) => void };
};

// JOB 2692 D1: zwei Backstops, EINE Stufe — die höhere gewinnt. Nur „vertraulich"/„streng_vertraulich"
// hebt; ein internes oder unbekanntes Ziel senkt nie (unveränderte Regel aus Round 4).
function hoehereStufe(
  a: Confidentiality | null | undefined,
  b: Confidentiality | null | undefined,
): Confidentiality | null {
  if (a === "streng_vertraulich" || b === "streng_vertraulich") {
    return "streng_vertraulich";
  }
  if (isConfidential(a ?? null)) {
    return a ?? null;
  }
  return b ?? a ?? null;
}

// WP-BILD-1f (bens P2): Body-Deckel NUR für die Bild-Route /api/reasoner/describe. 8 MiB deckt den
// String-Vorab-Deckel (7 Mio. Zeichen dataUrl) + JSON-Overhead; der TEXT-Dispatcher /api/reasoner
// behält bewusst den kleinen globalen 1-MiB-Fastify-Default. Über dem Cap: kontrolliertes 413 von
// Fastify; die Routen-Validierung meldet den 5-MB-Bild-Deckel zusätzlich mit ehrlicher Begründung.
export const DESCRIBE_BODY_LIMIT = 8 * 1024 * 1024; // 8 MiB

export function reasonerRoutes(deps: ReasonerRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner, ask, externalKnowledge, ko, capture, ka4 } = deps;

  // Ein Load je Anker liefert die hebende Stufe und den echten Subjektbezug. Keine frei
  // gelieferte Kennung wird als gefundenes Subjekt ausgegeben. Ohne Klara-Bindung bleibt der
  // Konsolenvertrag erhalten; mit Bindung schließen fehlender Dienst, Fehler und Ablehnung.
  const resolveProvenance = async (
    source: unknown,
    koId: unknown,
    declared: unknown,
    bindung: Aufrufbindung,
  ): Promise<{ confidential: boolean; subject?: ModelRunSubject }> => {
    let backstop: StoredLookup = { found: false };
    let subject: ModelRunSubject | undefined;
    const clientText = typeof source === "string" && CLIENT_TEXT_SOURCES.has(source);
    if (clientText && typeof koId === "string" && koId.length > 0) {
      const stored = await ko.get(koId);
      backstop = { found: stored !== undefined, level: stored?.confidentiality ?? null };
      if (stored !== undefined) {
        subject = { kind: "ko", id: stored.id };
      }
    }
    // JOB 2692 D1: der Entwurfs-Backstop. Nur `source:"draft"` trägt eine Entwurfskennung; ein
    // Upload (`transient-document`) ist neuer Inhalt und hat keinen gespeicherten Entwurf.
    if (source === "draft" && typeof bindung.draftId === "string" && bindung.draftId.length > 0) {
      const entwurf = await capture.getDraft(bindung.draftId);
      if (entwurf !== undefined) {
        backstop = {
          found: true,
          level: hoehereStufe(backstop.level, entwurf.payload.confidentiality ?? null),
        };
      }
    }
    const gebunden = klaraBindungVorhanden(bindung.headers);
    const dokumentZustimmung =
      gebunden &&
      (await ka4Freigabe(
        ka4,
        bindung.headers,
        bindung.actorId,
        bindung.log,
        "reasoner.ka4.dokument-consent",
      ));
    let confidential = classifyProvenanceConfidential(source, declared, backstop, {
      dokumentZustimmung: bindung.inhalt === "text" && dokumentZustimmung,
      nichtEingestuft: bindung.nichtEingestuft,
    });
    // ==========================================================================================
    // JOB 2692 D2 — OHNE AUFLÖSBAREN ANKER GILT „draft" ALS VERTRAULICH.
    // ==========================================================================================
    // BEN an D1: „Der tatsächliche Weg ohne Kennung wird weiterhin durchgelassen" — ein Backstop,
    // den man umgeht, indem man ein Feld nicht schickt, ist keiner. Deshalb: `source:"draft"`
    // braucht einen Anker, der sich im Bestand AUFLÖST — die `draftId` eines gespeicherten
    // Entwurfs oder die `koId` eines Objekts (KnowledgeDetail-Editor). Fehlt beides, oder löst
    // keins auf, entscheidet nicht mehr die Client-Deklaration: der Aufruf ist vertraulich.
    //
    // FAIL-CLOSED STATT ABWEISEN, und warum: Ein 4xx bräche Aufrufer, die legitim keinen Anker
    // haben — eine Erfassung, die noch nie gespeichert wurde (Capture ohne Entwurfskennung,
    // Vordertür), hat keinen. Sie verliert damit die Cloud, nicht die Funktion: structure/assist/
    // interview/describe laufen lokal bzw. deterministisch weiter. Der Preis ist benannt; ob eine
    // ungespeicherte Erfassung die Cloud bekommen soll (dann braucht sie vorher eine Kennung,
    // etwa durch Sichern des Entwurfs vor der ersten KI-Aktion), ist eine Ownerfrage — hier nicht
    // entschieden, in der Rückgabe gemeldet.
    //
    // Was eine FEHLENDE Stufe bedeutet, bleibt unberührt: ein aufgelöster Entwurf ohne Stufe hebt
    // nicht — dann gilt wie bisher die Deklaration (D1, Fall A5).
    const ankerAufgeloest = backstop.found;
    if (source === "draft" && !ankerAufgeloest) {
      confidential = true;
    }
    if (gebunden && !dokumentZustimmung) {
      confidential = true;
    }
    return {
      confidential,
      ...(subject ? { subject } : {}),
    };
  };

  // Bestandsfassade für alle NICHT gebundenen Zweige — seit JOB 2692 D1 mit derselben Bindung wie
  // der gebundene Zweig; sie hat keine eigene Regel und braucht deshalb keine eigene Erweiterung.
  const resolveConfidential = async (
    source: unknown,
    koId: unknown,
    declared: unknown,
    bindung: Aufrufbindung,
  ): Promise<boolean> => (await resolveProvenance(source, koId, declared, bindung)).confidential;

  return async (app) => {
    // WP-BILD-1f (bens P2): der Text-Dispatcher behält die KLEINE Parsergrenze (globaler
    // 1-MiB-Fastify-Default) — NUR der Bild-Task (eigene Route /api/reasoner/describe unten)
    // bekommt die große Grenze, mit Auth VOR dem großen Parse.
    app.post<{
      Body: {
        task: "structure" | "ask" | "assist" | "interview" | "extract";
        text?: string;
        answers?: string[];
        locale?: "de" | "en";
        // SCRUM-312: optionale Bearbeitungs-Anweisung für 'assist' (klarer/strukturieren/… oder frei).
        instruction?: string;
        // PMO-FEA-0006: optionaler Suchauftrag des Experten für 'extract' (wonach suchen?).
        query?: string;
        // SCRUM-451: Ergebnis-Sprache für 'extract' — "system" (Default, UI-Sprache) oder
        // "source" (Sprache des Dokuments, nichts übersetzen).
        outputLanguage?: "system" | "source";
        // Herkunft des verarbeiteten Textes; die gemeinsame Regel bewertet die Deklaration.
        // koId bleibt ein ausschließlich hebender Backstop.
        source?: "draft" | "transient-document";
        koId?: string;
        confidentiality?: Confidentiality;
        nichtEingestuft?: unknown;
        // JOB 2692 D1: Kennung des gespeicherten Entwurfs, aus dem der Text/das Bild stammt — nur
        // ein hebender Backstop (die gespeicherte Stufe hebt, senkt nie), nie ein Freigabe-Anker.
        draftId?: string;
      };
    }>("/api/reasoner", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const { task, text } = request.body;
      // FR-I18N-01: UI-Sprache steuert Prompt/Frage/Label (Quelleninhalt bleibt original).
      const locale = normalizeLocale(request.body.locale);
      if (task === "structure") {
        // SCRUM-502 Schicht 2: vertraulicher Draft/KO → Cloud aus der Kette (lokal/deterministisch).
        const confidential = await resolveConfidential(
          request.body.source,
          request.body.koId,
          request.body.confidentiality,
          {
            inhalt: "text",
            draftId: request.body.draftId,
            nichtEingestuft: request.body.nichtEingestuft,
            actorId: user.id,
            headers: request.headers,
            log: request.log,
          },
        );
        reply.code(200).send(await reasoner.structure(text ?? "", locale, confidential));
        return;
      }
      if (task === "ask") {
        // Kartierung SCRUM-502 Schicht 2: 'ask' trägt eine reine Nutzerfrage (kein gespeicherter
        // KO-Text); der Antwort-Kontext ist bereits Schicht-1-gefiltert. Keine Sensitivitäts-Route.
        //
        // JOB 2666 D2 (BEN, Korrekturpflicht 3: „Nachweis … der `task:"ask"`-Enge"): Trägt der
        // Aufruf eine Klara-Bindung und ist keine Einwilligung bestätigt, läuft die Frage in
        // DERSELBEN Enge wie `/api/ask` im Modus `retrieval-only` (ask-routes.ts: `validatedOnly` +
        // `retrievalOnly`) — sonst wäre dieser Task die Tür um das KA4-Tor herum, das die Text- und
        // Bildwege seit 2692 schließt. Dasselbe Tor, derselbe Aufruf (`ka4Freigabe`), derselbe
        // Protokollname wie die übrigen Reasoner-Wege. Ohne Bindung (Konsole) byteweise wie zuvor.
        const gebundenOhneFreigabe =
          klaraBindungVorhanden(request.headers) &&
          !(await ka4Freigabe(
            ka4,
            request.headers,
            user.id,
            request.log,
            "reasoner.ka4.dokument-consent",
          ));
        reply.code(200).send(
          gebundenOhneFreigabe
            ? await ask.ask(text ?? "", user.id, locale, {
                validatedOnly: true,
                retrievalOnly: true,
              })
            : await ask.ask(text ?? "", user.id, locale),
        );
        return;
      }
      if (task === "assist") {
        // FR-RSN-03 / SCRUM-312: Text präzisieren/glätten, optional mit Bearbeitungs-Anweisung.
        const confidential = await resolveConfidential(
          request.body.source,
          request.body.koId,
          request.body.confidentiality,
          {
            inhalt: "text",
            draftId: request.body.draftId,
            nichtEingestuft: request.body.nichtEingestuft,
            actorId: user.id,
            headers: request.headers,
            log: request.log,
          },
        );
        reply
          .code(200)
          .send(
            await reasoner.assistText(text ?? "", locale, request.body.instruction, confidential),
          );
        return;
      }
      if (task === "interview") {
        // SCRUM-132: reasoner-getriebenes Interview, stateless (Antworten rein).
        const confidential = await resolveConfidential(
          request.body.source,
          request.body.koId,
          request.body.confidentiality,
          {
            inhalt: "text",
            draftId: request.body.draftId,
            nichtEingestuft: request.body.nichtEingestuft,
            actorId: user.id,
            headers: request.headers,
            log: request.log,
          },
        );
        reply
          .code(200)
          .send(await reasoner.interview(request.body.answers ?? [], locale, confidential));
        return;
      }
      if (task === "extract") {
        // SCRUM-451: Ergebnis-Sprache validieren — nur die zwei bekannten Werte, sonst 400.
        const outputLanguage = request.body.outputLanguage;
        if (
          outputLanguage !== undefined &&
          outputLanguage !== "system" &&
          outputLanguage !== "source"
        ) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "outputLanguage muss 'system' oder 'source' sein.",
          });
          return;
        }
        // PMO-FEA-0006: Wissenspunkte aus Dokumenttext (optional mit Suchauftrag). Ohne
        // Modell antwortet der Reasoner ehrlich mit leerer Liste + note (keine Fake-Punkte).
        // SCRUM-502 Schicht 2: vertraulicher Dokumenttext/KO → Cloud aus der Kette.
        //
        // mega26 Block A — DIES IST DER GEBUNDENE AUFRUFER. Warum gerade extract: von allen Wegen,
        // die über `runTask` einen ModelRunRecord erzeugen, ist er der einzige, dessen Modell-
        // ERGEBNIS unmittelbar zu bleibendem Wissen wird — die extrahierten Punkte werden als
        // KoSource mit Belegzitat an ein KO geschrieben (`from-document` / `append-document`) und
        // tragen von dort an eine Beweiskette. Und er ist der Weg, auf dem der Aufrufer den
        // Subjektbezug WIRKLICH kennt: das BodyExtractPanel schickt die koId des Ziel-Objekts mit
        // (`apps/web/src/components/BodyExtractPanel.tsx:125-131`). Bei `structure` (neuer Entwurf)
        // gibt es typischerweise noch gar kein KO, bei `ask` ist das Subjekt eine Trefferliste
        // statt eines Objekts. Die übrigen Zweige bleiben BEWUSST kontextlos — sie schreiben
        // weiterhin einen Datensatz ohne actor/subject, statt einen zu erfinden.
        const provenance = await resolveProvenance(
          request.body.source,
          request.body.koId,
          request.body.confidentiality,
          {
            inhalt: "text",
            draftId: request.body.draftId,
            nichtEingestuft: request.body.nichtEingestuft,
            actorId: user.id,
            headers: request.headers,
            log: request.log,
          },
        );
        reply.code(200).send(
          await reasoner.extract(
            text ?? "",
            locale,
            request.body.query,
            outputLanguage === "source",
            provenance.confidential,
            // Der Actor ist der AUTHENTIFIZIERTE Nutzer der Session (`ko.read`-Guard oben) —
            // kein Header, kein Body-Feld, nichts Geratenes. Der Subjektbezug kommt nur zustande,
            // wenn die koId ein KO im Bestand traf. Weder hier noch tiefer reist Prompt-,
            // Dokument- oder Antworttext mit: der Kontext trägt ausschliesslich Kennungen.
            { actor: user.id, ...(provenance.subject ? { subject: provenance.subject } : {}) },
          ),
        );
        return;
      }
      reply.code(400).send({
        error: "BAD_REQUEST",
        message: "task muss 'structure', 'ask', 'assist', 'interview' oder 'extract' sein.",
      });
    });

    // WP-BILD-1c/1f (bens P2+P3): EIGENE Route für den Bild-Task — nur SIE trägt die große
    // Parsergrenze (Muster WP-D1d: bodyLimit + AUTH VOR dem Body-Parsing, damit die vergrößerte
    // Parser-Fläche anonym nicht offensteht; der Handler prüft danach die konkrete Berechtigung
    // ko.read — Defense-in-Depth). Die Bild-Daten werden STRIKT und FRÜH validiert (Format ohne
    // SVG, strikte Base64, DEKODIERTE Bytegrenze, Magic-Bytes gegen die deklarierte MIME) —
    // bei jeder Ablehnung läuft NULL Provider-/HTTP-Aufruf.
    const requireAuthedBeforeParse = async (
      request: Parameters<Guards["requireUser"]>[0],
      reply: Parameters<Guards["requireUser"]>[1],
    ): Promise<void> => {
      await guards.requireUser(request, reply);
    };
    app.post<{
      Body: {
        dataUrl?: string;
        locale?: "de" | "en";
        // Bild-Einstufungen bleiben fail-closed: Dokumentzustimmung hebt hier weder eine
        // fehlende Stufe noch den Textmarker; ausdrückliches intern behält den KA4-Riegel.
        source?: "draft" | "transient-document";
        koId?: string;
        confidentiality?: Confidentiality;
        nichtEingestuft?: unknown;
        // JOB 2692 D1: Kennung des gespeicherten Entwurfs, aus dem der Text/das Bild stammt — nur
        // ein hebender Backstop (die gespeicherte Stufe hebt, senkt nie), nie ein Freigabe-Anker.
        draftId?: string;
        // WP-BILD-1f (Pedi 22.07.): optionaler umgebender Dokument-Kontext (Klartext). Er läuft durch
        // DIESELBE resolveConfidential-/providerChain-Stelle wie das Bild — bei vertraulichem Beitrag
        // erreicht weder Bild noch Kontext die Cloud. Der Reasoner kappt den Kontext autoritativ.
        context?: string;
      };
    }>(
      "/api/reasoner/describe",
      { bodyLimit: DESCRIBE_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const dataUrl = request.body.dataUrl;
        // Schneller String-Vorab-Deckel, dann die strikte Prüfung (bens P3) — alles deterministisch
        // und VOR jedem Provider-Aufruf.
        const verdict =
          typeof dataUrl === "string" && dataUrl.length > MAX_DESCRIBE_IMAGE_DATAURL_CHARS
            ? ({ ok: false, code: "too-large" } as const)
            : validateDescribeImageDataUrl(dataUrl);
        if (!verdict.ok) {
          if (verdict.code === "too-large") {
            reply.code(413).send({
              error: "PAYLOAD_TOO_LARGE",
              message: "Das Bild ist zu groß für den Beschreibungs-Vorschlag (max. 5 MB).",
            });
            return;
          }
          const message =
            verdict.code === "format"
              ? "dataUrl fehlt oder ist keine data:image-URL der erlaubten Formate (png/jpeg/gif/webp — kein SVG)."
              : verdict.code === "base64"
                ? "Die Bild-Daten sind keine gültige Base64-Kodierung."
                : "Die Bild-Daten passen nicht zum deklarierten Bildformat.";
          reply.code(400).send({ error: "BAD_REQUEST", message });
          return;
        }
        const locale = normalizeLocale(request.body.locale);
        const confidential = await resolveConfidential(
          request.body.source,
          request.body.koId,
          request.body.confidentiality,
          {
            inhalt: "bild",
            draftId: request.body.draftId,
            nichtEingestuft: request.body.nichtEingestuft,
            actorId: user.id,
            headers: request.headers,
            log: request.log,
          },
        );
        // WP-BILD-1f: Kontext nur weiterreichen, wenn String; der Reasoner kappt ihn autoritativ auf
        // MAX_IMAGE_CONTEXT_LENGTH und schickt ihn NUR über den (vertraulichkeitsgefilterten) Vision-Weg.
        const context = typeof request.body.context === "string" ? request.body.context : undefined;
        reply
          .code(200)
          .send(await reasoner.describeImage(dataUrl as string, locale, confidential, context));
      },
    );

    // SCRUM-426: Public-KI-Anreicherung (Modellwissen) — bewusst NICHT quellengebunden.
    // Zwei Gates: (1) Schreibberechtigung (ko.create); (2) der Admin-Regler „externe
    // Wissensabfrage" muss auf „offen" stehen (publicAiEnrichmentAllowed) — sonst 403.
    // Ergebnis ist extern/ungeprüft; die UI kennzeichnet das und übernimmt nur bewusst.
    app.post<{ Body: { query?: string; locale?: "de" | "en" } }>(
      "/api/reasoner/enrich",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const stage = (await externalKnowledge.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
        if (!publicAiEnrichmentAllowed(stage)) {
          reply.code(403).send({
            error: "PUBLIC_AI_ENRICHMENT_BLOCKED",
            message: "Die Public-KI-Anreicherung ist vom Administrator nicht freigegeben.",
          });
          return;
        }
        const query = (request.body?.query ?? "").trim();
        if (query.length === 0) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "query fehlt." });
          return;
        }
        reply
          .code(200)
          .send(await reasoner.enrichPublic(query, normalizeLocale(request.body.locale)));
      },
    );

    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
    // WP-VIP2-GATE-2 (bens Fix 3): jetzt ECHTE Admin-Sicht — users.manage statt ko.read. Die
    // Provider-/Modellnamen sind Infrastruktur-Details; normale Nutzer brauchen nur den
    // abstrahierten oeffentlichen Status (/api/reasoner/status bzw. /api/ai-status: active+mode).
    app.get("/api/reasoner/config", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(reasoner.configStatus());
    });

    // KI-Verwaltung v1 (02.07.2026, Teil-Slice): Zuordnung global + je Aufgabe setzen.
    // Nur Admin; keine Schlüssel — die leben weiter ausschließlich serverseitig.
    app.put<{ Body: { global?: string; perTask?: Record<string, string> } }>(
      "/api/reasoner/config",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          // Laufzeit-Validierung übernimmt setTaskConfig (wirft bei ungültigen Werten).
          // SCRUM-525 P.5 (WP6): setTaskConfig persistiert jetzt → die Zuordnung überlebt Neustart/Deploy.
          await reasoner.setTaskConfig({
            global: request.body.global ?? "auto",
            perTask: request.body.perTask ?? {},
          } as Parameters<typeof reasoner.setTaskConfig>[0]);
          reply.code(200).send(reasoner.configStatus());
        } catch (error) {
          // SCRUM-525 P.5 (WP-C): Befund 3(a) — ein aktiver ENV-Override (KLARWERK_REASONER_POLICY) lehnt
          // den Schreibversuch ab (409, ehrliche Begründung), statt ihn wie einen 400-Validierungsfehler
          // zu behandeln oder still zu übernehmen.
          if (error instanceof ReasonerPolicyLockedError) {
            reply.code(409).send({ error: "REASONER_POLICY_ENV_LOCKED", message: error.message });
            return;
          }
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Ungültige KI-Zuordnung.",
          });
        }
      },
    );

    // SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets). Lesen darf jede angemeldete
    // Rolle (die Palette im Editor zeigt sie an); verwalten nur der Admin. Leitplanken:
    // Presets sind benannte instructions für den VORHANDENEN assist-Task — keine neue
    // Modellfläche, keine Secrets; Vorschau + bewusste Übernahme (G-3) bleiben unverändert.
    app.get("/api/reasoner/assist-presets", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.getAssistPresets());
    });

    app.put<{ Body: { presets?: { id?: string; name?: string; instruction?: string }[] } }>(
      "/api/reasoner/assist-presets",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(await reasoner.setAssistPresets(request.body?.presets ?? []));
        } catch (error) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Ungültige KI-Funktionen.",
          });
        }
      },
    );

    // Key-Test (Pedi 02.07.): echter Mini-Aufruf gegen das konfigurierte Modell — beweist,
    // ob der hinterlegte Schlüssel WIRKLICH funktioniert (401 wird ehrlich benannt).
    // Nur Admin; der Schlüssel selbst verlässt den Server nie.
    app.post("/api/reasoner/test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.probe());
    });

    // SCRUM-428: Key-Test für den eigenen lokalen LLM (echter Mini-Aufruf über den Tunnel).
    app.post("/api/reasoner/test-local", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.probeLocal());
    });

    // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung — beweist, dass judgeConflict im
    // deployten Stand antwortet UND kollision liefert. Läuft die echte Erkennungskette gegen einen
    // Wegwerf-Repo (kein Fußabdruck, idempotent). Nur Admin; der Schlüssel verlässt den Server nie.
    app.post("/api/reasoner/conflict-self-test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await runConflictSelfTest(reasoner));
    });

    // SCRUM-494: End-to-End-Selbsttest der Duplikat-Erkennung — beweist, dass judgeDuplicate im
    // deployten Stand ein semantisches Duplikat erkennt (der reifen-Fall, den der deterministische
    // Ersatzmodus nicht sehen kann). Echte Kette gegen einen Wegwerf-Repo (kein Fußabdruck,
    // idempotent). Nur Admin; der Schlüssel verlässt den Server nie.
    app.post("/api/reasoner/duplicate-self-test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await runDuplicateSelfTest(reasoner));
    });
  };
}
