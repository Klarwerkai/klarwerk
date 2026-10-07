import type { FastifyPluginAsync } from "fastify";
import type { CaptureService } from "../../../capture";
import type { ConflictService } from "../../../conflicts";
import { type Confidentiality, type KoService, isConfidential } from "../../../knowledge-object";
import { type Reasoner, imBindungsrahmen } from "../../../reasoner";
import type { Guards } from "../http";
import { checkKnowledge } from "../knowledge-check";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";
import { type Ka4Freigabepruefer, ka4Freigabe, klaraBindungVorhanden } from "./ask-routes";
import { classifyProvenanceConfidential, ohneEinstufung } from "./reasoner-routes";

// SCRUM-527 (Live-Check): POST /api/knowledge/check — echte Ähnlichkeits-/Widerspruchsprüfung eines
// Entwurfstextes gegen den Bestand, für die Live-Reaktion in „Wissen erfassen". Auth-geschützt
// (requirePermission("ko.read") → vom routeGuardAudit erfasst, kein Blindspot). never block: bei einem
// Fehler ehrlicher Status statt 5xx.
//
// JOB 3556 R3: Die Dokumentzustimmung läuft ab jetzt über den BESTEHENDEN Riegel (KA4-Bindung an den
// Kopfzeilen + `ka4Freigabe`), denselben, den `ask-routes`, `reasoner-routes` und `check-text-routes`
// benutzen — vorher stand hier fest `false`. Für den Browser-Editor ändert das NICHTS: er trägt keine
// Klara-Bindung, also bleibt seine Zustimmung `false` und nicht eingestufter Text erreicht weiterhin
// keine Cloud, sondern nur similar und status "pending".
export interface KnowledgeCheckRouteDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
  guards: Guards;
  // JOB 3556 (LIVE-CHECK-VERDRAHTUNG A): der ENTWURFS-Backstop, wie ihn `reasoner-routes` seit
  // JOB 2692 D1 führt — nur `getDraft`, kein Schreibrecht. OPTIONAL, damit bestehende Aufrufer
  // unverändert bauen; fehlt er, löst sich KEIN `draftId`-Anker auf und `source:"draft"` ist
  // fail-closed vertraulich (siehe unten).
  capture?: Pick<CaptureService, "getDraft"> | undefined;
  // JOB 3556 R3: derselbe KA4-Riegel wie in `reasoner-routes` (`:287-296`) — dieselbe Dienstinstanz,
  // dieselben Kopfzeilen, dieselbe Auslegung. OPTIONAL: fehlt er, ist jede Klara-gebundene Anfrage
  // ohne bestätigte Einwilligung — also fail-closed vertraulich, nie freier.
  ka4?: Ka4Freigabepruefer | undefined;
}

// Dieselbe reine Herkunftsregel; koId bleibt ausschließlich hebender Backstop.
//
// JOB 3556 — DIE STUFE KOMMT AUS DEM BESTAND, NICHT AUS DER CLIENT-DEKLARATION.
// Codex' Lehre zu JOB 3427 R2: „ein zweiter Fall zeigt, dass eine GEFÄLSCHTE Client-Einstufung den
// Judge NICHT erreicht". Bis hierher konnte diese Route das für Entwürfe gar nicht prüfen: sie kannte
// nur den `koId`-Anker, und der Editor bearbeitet einen ENTWURF. Ein als „vertraulich" gespeicherter
// Entwurf, für den der Client „intern" deklariert, wäre also durchgelaufen. Der `draftId`-Backstop
// aus JOB 2692 D1 schliesst genau das — dasselbe Feld, dieselbe Bedeutung, dieselbe Richtung.
async function resolveDraftConfidential(
  body: {
    source?: string;
    koId?: string;
    draftId?: string;
    confidentiality?: string;
    nichtEingestuft?: unknown;
  },
  ko: KoService,
  capture: Pick<CaptureService, "getDraft"> | undefined,
  dokumentZustimmung: boolean,
): Promise<boolean> {
  let backstop = { found: false } as { found: boolean; level?: Confidentiality | null };
  if (
    (body.source === "draft" || body.source === "transient-document") &&
    typeof body.koId === "string" &&
    body.koId.length > 0
  ) {
    const stored = await ko.get(body.koId);
    backstop = { found: stored !== undefined, level: stored?.confidentiality ?? null };
  }
  // Nur `source:"draft"` trägt eine Entwurfskennung; ein Upload (`transient-document`) ist neuer
  // Inhalt und hat keinen gespeicherten Entwurf (unveränderte Regel aus JOB 2692 D1).
  if (
    body.source === "draft" &&
    typeof body.draftId === "string" &&
    body.draftId.length > 0 &&
    capture !== undefined
  ) {
    const entwurf = await capture.getDraft(body.draftId);
    if (entwurf !== undefined) {
      const gespeichert = entwurf.payload.confidentiality ?? null;
      // ER HEBT, ER SENKT NIE: nur eine vertrauliche gespeicherte Stufe verändert die STUFE des
      // Backstops. Eine Rangordnung zwischen „vertraulich" und „streng_vertraulich" braucht es hier
      // nicht — die Regel liest den Backstop ausschliesslich über `isConfidential`, und beide sperren
      // gleich. Der FUND dagegen zählt immer: ein aufgelöster interner Entwurf ist ein aufgelöster
      // Anker (dieselbe Buchführung wie `reasoner-routes.ts:281-286`).
      backstop = {
        found: true,
        level: isConfidential(gespeichert) ? gespeichert : (backstop.level ?? null),
      };
    }
  }
  const confidential = classifyProvenanceConfidential(body.source, body.confidentiality, backstop, {
    dokumentZustimmung,
    nichtEingestuft: body.nichtEingestuft,
  });
  // ============================================================================================
  // JOB 3556 R3 — OHNE AUFLÖSBAREN ANKER GILT „draft" ALS VERTRAULICH.
  // ============================================================================================
  // BEN an R2: „Derselbe Text bleibt mit dem korrekten vertraulichen Entwurfsanker gesperrt,
  // erreicht aber nach Weglassen oder Ersetzen durch eine unbekannte Kennung den Judge." Genau die
  // Lücke, die `reasoner-routes.ts:301-323` seit JOB 2692 D2 geschlossen hat und die hier fehlte:
  // eine Deklaration „intern" ohne Anker, der sich im Bestand AUFLÖST, entschied allein über den
  // Egress — ein Backstop, den man durch Weglassen eines Feldes umgeht, ist keiner.
  //
  // FAIL-CLOSED STATT ABWEISEN, aus demselben Grund wie dort: ein 4xx bräche Aufrufer, die legitim
  // keinen Anker haben — ein Blatt, das noch nie gesichert wurde, hat keinen. Es verliert damit die
  // Widerspruchsprüfung (ehrliches „nicht geprüft"), nicht die Funktion: die deterministische
  // Ähnlichkeit läuft unverändert weiter. Der Weg zurück ist einer, den der Mensch kennt: sichern.
  //
  // N11b (P-N11b, Ben nacharbeit-1): NICHT eingestufter Text mit bestätigter Dokumentzustimmung
  // braucht keinen gespeicherten Anker — dieselbe enge Ausnahme wie `reasoner-routes.ts`.
  // Ausdrückliches „intern" ohne Anker bleibt gesperrt; ein vertraulicher Anker hebt weiterhin.
  const zustimmungMachtIntern =
    dokumentZustimmung === true && ohneEinstufung(body.confidentiality, body.nichtEingestuft);
  if (body.source === "draft" && !backstop.found && !zustimmungMachtIntern) {
    return true;
  }
  return confidential;
}

export function knowledgeCheckRoutes(deps: KnowledgeCheckRouteDeps): FastifyPluginAsync {
  return async (app) => {
    // Bens B3 (Runde 2): je Anfrage ein Rahmen für die Klara-Anbieterbindung
    // (`services/reasoner/src/anbieterbindung.ts`) — das Tor hält sein Ergebnis darin fest, der
    // Reasoner liest es beim Kettenbau. `run(…, done)` ist das Muster von `@fastify/request-context`.
    app.addHook("onRequest", (_request, _reply, done) => {
      imBindungsrahmen(() => done());
    });
    app.post<{
      // source/koId/confidentiality optional (kein Schema) — Alt-Clients ohne diese Felder bekommen
      // fail-safe „vertraulich" (kein Egress), nie 400.
      Body: {
        text?: string;
        source?: string;
        koId?: string;
        // JOB 3556: die Kennung des GESPEICHERTEN Entwurfs — hebender Backstop, nie Freigabe-Anker.
        draftId?: string;
        confidentiality?: string;
        nichtEingestuft?: unknown;
      };
    }>("/api/knowledge/check", async (request, reply) => {
      const user = await deps.guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const body = request.body ?? {};
      const text = typeof body.text === "string" ? body.text : "";
      // JOB 3556 R3 — DIE ZUSTIMMUNG KOMMT AUS DEM BESTEHENDEN RIEGEL, NICHT AUS DER NUTZLAST.
      // Dieselben drei Kopfzeilen und derselbe Prüfer wie auf dem Reasoner-Weg (`reasoner-routes.ts
      // :287-296`): eine Anfrage OHNE Klara-Bindung — der Browser-Editor — ist der Normalfall und
      // bleibt unverändert (`gebunden === false` → `dokumentZustimmung === false`, wie bisher fest
      // verdrahtet). Eine Anfrage MIT Bindung ohne bestätigte Einwilligung erreicht die Cloud nicht.
      const gebunden = klaraBindungVorhanden(request.headers);
      const dokumentZustimmung =
        gebunden &&
        (await ka4Freigabe(
          deps.ka4,
          request.headers,
          user.id,
          request.log,
          "knowledge-check.ka4.dokument-consent",
          // Bens B3: die Urteile folgen der GLOBALEN Wahl, nicht der Aufgabe `answer`.
          "global",
        ));
      // Fail-safe Vertrag: vertraulich/unklassifiziert ODER kein Modell → KEIN Judge (kein Cloud-Egress
      // des Freitexts). Nur nicht-vertraulich + Modell verfügbar → echter Widerspruchs-Judge.
      let confidential = await resolveDraftConfidential(
        body,
        deps.ko,
        deps.capture,
        dokumentZustimmung,
      );
      if (gebunden && !dokumentZustimmung) {
        confidential = true;
      }
      const modelActive = deps.reasoner.status().active;
      const judge =
        !confidential && modelActive
          ? (coreA: string, coreB: string) => deps.reasoner.judgeConflict(coreA, coreB)
          : null;
      const result = await checkKnowledge(text, {
        ko: deps.ko,
        conflicts: deps.conflicts,
        judge,
        // produkt:20261007:spaces: ähnliche Artikel und Widersprüche nur aus dem, was dieser Mensch
        // sehen darf (Stufe, Autor, führender Space) — die eine Regel aus `../sichtbarkeit`.
        sichtbar: sichtbarkeitsfilterFuer(user),
      });
      reply.code(200).send(result);
    });
  };
}
