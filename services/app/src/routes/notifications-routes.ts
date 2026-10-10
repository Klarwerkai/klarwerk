import type { FastifyPluginAsync } from "fastify";
import {
  ANTWORT_MELDUNG_ACTION,
  type AskService,
  isAntwortMeldeGrund,
  redactGapForViewer,
} from "../../../ask";
import type { AuditService } from "../../../audit";
import type { ConflictService, OverlapService } from "../../../conflicts";
import type { NotificationSeenRepo } from "../../../notifications";
import { can } from "../../../rbac";
import type { ValidationService } from "../../../validation";
import type { Guards, SessionUser } from "../http";
import type { LoeschantragMeldung } from "../loeschantraege";
import {
  type FrischeNotice,
  type ImpactNotice,
  type KenntnisnahmeNotice,
  type Notification,
  type ReklamationNotice,
  type VeroeffentlichungNotice,
  buildNotifications,
} from "../notification-feed";
import {
  type KoSichtbarkeitsZugang,
  sichtbareEintraege,
  sichtbarePaare,
  sichtbarkeitsfilterFuer,
} from "../sichtbarkeit";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  // Pedi 04.07.: offene Überschneidungen (Duplikate) in der Glocke, analog zu Konflikten.
  overlaps: OverlapService;
  ask: AskService;
  // SCRUM-363 / AG-15: Quelle der persönlichen offenen Review-Zuweisungen.
  validation: ValidationService;
  // PMO-FEA-0002: Wirkungs-Rückmeldungen werden aus dem Audit-Log abgeleitet (read-only).
  audit: AuditService;
  // Audit-P3 (SCRUM-397): pro Nutzer bewusst als gesehen markierte Benachrichtigungs-IDs.
  seen: NotificationSeenRepo;
  // AUFTRAG-mega74 BLOCK D (G5): Zugang zur Sichtbarkeit der beteiligten Wissensobjekte.
  //
  // AUFTRAG-mega76 BLOCK A: von `kos?` auf PFLICHT. Diese Route ist die schwächste Tür des Satzes
  // (sie steht auf `requireUser`, nicht auf `ko.read`); fehlte der Zugang, trug der Feed die
  // Konflikt-`description`, die Duplikat-`rationale` und den KO-Titel einer Zuweisung ungefiltert.
  // Pflichtparameter ohne Umbau möglich: einziger Aufrufer ist build-app.ts:1018.
  kos: KoSichtbarkeitsZugang;
  // Kenntnisnahme: die offenen Anforderungen der aktuellen Person (Anforderung, Erinnerung, Frist).
  // Optional, weil der Feed auch ohne diesen Dienst gebaut werden kann; die Sichtbarkeit läuft
  // unten in jedem Fall über dieselbe Prüfung wie bei den Zuweisungen.
  kenntnisnahmen?: { meldungenFuer(nutzerId: string): Promise<KenntnisnahmeNotice[]> };
  // Löschanträge (R-0661): die offenen Anträge als Verwalteraufgabe mit Frist. Optional wie die
  // Kenntnisnahme; abgefragt wird nur für Betrachter mit `users.manage`.
  loeschantraege?: { offene(): Promise<LoeschantragMeldung[]> };
  // aufnahme:20260922:gesamt-wissen-frische: Fristerinnerung (R-0248), Wochenvorlage (R-0266) und
  // Prüfanforderung an Autor bzw. Nachfolger (R-1635) — `frische-meldungen.ts`. Optional wie die
  // Kenntnisnahme; die Sichtbarkeit läuft unten über dieselbe Prüfung.
  frische?: { meldungenFuer(nutzerId: string): Promise<FrischeNotice[]> };
  // Veröffentlichung: Meldungen bei „normal"/„hervorgehoben" an den festgehaltenen Empfängerkreis.
  // Die Sichtbarkeit wird unten trotzdem neu geprüft — ein späterer Entzug wirkt sofort.
  veroeffentlichungen?: { meldungenFuer(nutzerId: string): Promise<VeroeffentlichungNotice[]> };
}

// PMO-FEA-0002: „Hat geholfen"-Ereignisse für den Originalautor. Bewusst ehrlich:
// nur fremde Klicks (kein Selbst-Applaus), nur Einträge mit Autor/Titel-Payload,
// begrenzt auf die letzten 12 — kein Zähler, keine Rangliste (EK-19-Richtung).
//
// RECHERCHE:pmo-fea-0002: „auch nach Übergabe der Verantwortung". Gemeldet wird dem Autor zum
// Zeitpunkt des Danks (`koAuthor`) UND dem ursprünglichen Autor (`koOriginalAuthor`) — derselbe
// Klick erzeugt für eine Person genau eine Meldung. Ein Eintrag, der NUR über den Urheber trifft,
// trägt `nurUrheber`: dort greift die Autor-Ausnahme der Sichtbarkeit nicht mehr (s. loadFeed).
// Alt-Einträge ohne `koOriginalAuthor` wirken wie bisher nur für `koAuthor`.
export function deriveImpacts(
  entries: Array<{ actor: string; target: string; at: string; payload: Record<string, unknown> }>,
  userId: string,
): Array<ImpactNotice & { nurUrheber?: true }> {
  const out: Array<ImpactNotice & { nurUrheber?: true }> = [];
  for (const e of entries) {
    const koAuthor = e.payload.koAuthor;
    const koOriginalAuthor = e.payload.koOriginalAuthor;
    const koTitle = e.payload.koTitle;
    if (e.actor === userId || typeof koTitle !== "string") {
      continue;
    }
    if (koAuthor === userId) {
      out.push({ koId: e.target, title: koTitle, at: e.at });
    } else if (koOriginalAuthor === userId) {
      out.push({ koId: e.target, title: koTitle, at: e.at, nurUrheber: true });
    }
  }
  return out.slice(-12);
}

// R-1089: Meldungen „Antwort falsch / Quelle passt nicht" für die verantwortliche Person. Zugestellt
// ist, was der Dienst beim Melden als `responsible` festgehalten hat — dieselbe Auskunft, die die
// Quittung des Meldenden nennt; ein späterer Eigentümerwechsel verschiebt keine alte Meldung.
// Nur Einträge mit vollständiger Payload — und ALLE davon. Ben (Nacharbeit 3): eine Kürzung auf die
// letzten N machte eine quittierte Meldung unerreichbar, sobald vor dem nächsten Abruf mehr
// eingingen; ein Weg zu älteren Meldungen existiert nicht. Was zugestellt ist, bleibt im Feed.
export function deriveReklamationen(
  entries: Array<{ target: string; at: string; payload: Record<string, unknown> }>,
  userId: string,
): ReklamationNotice[] {
  const out: ReklamationNotice[] = [];
  for (const e of entries) {
    const { responsible, koTitle, meldungId, grund } = e.payload;
    if (
      responsible !== userId ||
      typeof koTitle !== "string" ||
      typeof meldungId !== "string" ||
      !isAntwortMeldeGrund(grund)
    ) {
      continue;
    }
    out.push({ meldungId, koId: e.target, title: koTitle, grund, at: e.at });
  }
  return out;
}

// Audit-P3 (SCRUM-397): Feed einmal bauen, Gelesen-Status je Item ehrlich anreichern.
// FUNKE-FIX3 P0 (bens Blocker B): der Feed wird PRO BETRACHTER gebaut — die Gap-Ableitung läuft
// durch denselben zentralen Sichtbarkeitsvertrag wie /api/gaps (gap-visibility.redactGapForViewer):
// Fragetext nur für Owner/Assignee (R-0585: kein Rollenrecht mehr); alle anderen erhalten NUR einen
// redigierten Eintrag (leerer Titel + redacted-Marker → neutrale Bezeichnung im Client). Der
// Betrachter stammt IMMER aus der authentifizierten Session (Route), nie aus dem Body/Client.
async function loadFeed(
  deps: NotificationRoutesDeps,
  user: SessionUser,
): Promise<Array<Notification & { seen: boolean }>> {
  // SCRUM-363: Zuweisungen werden PRO NUTZER geladen (user.id) — der Feed zeigt nur die
  // Review-Arbeit der angemeldeten Person, keine fremden Zuweisungen.
  const [conflicts, overlaps, gaps, assignments, helpful, gemeldet, seenIds] = await Promise.all([
    deps.conflicts.unresolved(),
    deps.overlaps.unresolved(),
    deps.ask.listGaps(),
    deps.validation.openAssignmentsFor(user.id),
    deps.audit.list({ action: "answer.helpful" }),
    deps.audit.list({ action: ANTWORT_MELDUNG_ACTION }),
    deps.seen.seenFor(user.id),
  ]);
  const viewer = { viewerId: user.id };
  const gapViews = gaps.map((gap) => redactGapForViewer(gap, viewer));
  const alleImpacts = deriveImpacts(helpful, user.id);
  const seen = new Set(seenIds);
  // ================================================================================================
  // AUFTRAG-mega74 BLOCK D (G5) — DIE SCHWÄCHSTE TÜR DES GANZEN SATZES.
  // ================================================================================================
  //
  // Diese Route stand auf `requireUser` — schwächer als `ko.read` — und schrieb die Konflikt-
  // `description`, die Duplikat-`rationale` und den KO-TITEL einer Zuweisung ungefiltert als
  // `title` in den Feed (notification-feed.ts:57-68 und :81-89). Nur der Gap-Zweig war redigiert.
  // Wer ein vertrauliches Objekt nicht öffnen durfte, bekam seinen Kern in der Glocke serviert.
  //
  // Die Impacts des AUTORS brauchen KEIN Tor: dort ist der Betrachter selbst `koAuthor` — die
  // trägt die Autor-Ausnahme des Prädikats ohnehin.
  //
  // RECHERCHE:pmo-fea-0002: Meldungen, die NUR über den ursprünglichen Autor treffen (`nurUrheber`),
  // laufen dagegen durch dasselbe Tor wie die Zuweisungen. Nach einer Übergabe ist der Urheber
  // nicht mehr `author`; darf er das Objekt nicht mehr sehen, erscheint auch dessen Titel nicht.
  //
  // AUFTRAG-mega76 BLOCK A: die drei Aufrufe standen unter `deps.kos ? ... : <ungefiltert>`. Der
  // Zugang ist jetzt Pflicht, und die Filter laufen UNBEDINGT — es gibt keinen Zweig mehr, der das
  // alte Ergebnis zurückgibt.
  const sichtbareKonflikte = await sichtbarePaare(user, conflicts, deps.kos);
  const sichtbareUeberschneidungen = await sichtbarePaare(user, overlaps, deps.kos);
  // Eine Zuweisung nennt den Titel ihres Wissensobjekts. Sie ist bereits auf den Betrachter
  // beschränkt (openAssignmentsFor), aber ein Prüfer ohne `ko.validate` kann auf ein vertrauliches
  // Objekt angesetzt sein, das er nicht öffnen darf — dann darf auch der Titel nicht erscheinen.
  const sichtbareZuweisungen = await sichtbareEintraege(user, assignments, deps.kos);
  // Kenntnisnahme: derselbe Filter wie bei den Zuweisungen — wem der Zugriff auf den Eintrag
  // entzogen wurde, der sieht auch dessen Titel in der Glocke nicht mehr.
  const offeneKenntnisnahmen = (await deps.kenntnisnahmen?.meldungenFuer(user.id)) ?? [];
  const sichtbareKenntnisnahmen = await sichtbareEintraege(user, offeneKenntnisnahmen, deps.kos);
  // Löschanträge sind Arbeit der Verwaltung: nur wer Konten löschen darf, sieht sie — und damit
  // die Namen der Antragsteller.
  const loeschantraege =
    deps.loeschantraege && can(user.role, "users.manage") ? await deps.loeschantraege.offene() : [];
  // R-1089: dieselbe Prüfung — wer das Objekt (inzwischen) nicht öffnen darf, sieht den Titel nicht.
  const sichtbareReklamationen = await sichtbareEintraege(
    user,
    deriveReklamationen(gemeldet, user.id),
    deps.kos,
  );
  // aufnahme:20260922:gesamt-wissen-frische: dieselbe Prüfung — ein Titel erscheint nur, wenn der
  // Betrachter das Objekt sehen darf.
  const frischeMeldungen = (await deps.frische?.meldungenFuer(user.id)) ?? [];
  const sichtbareFrische = await sichtbareEintraege(user, frischeMeldungen, deps.kos);
  const sichtbareUrheberImpacts = new Set(
    await sichtbareEintraege(
      user,
      alleImpacts.filter((im) => im.nurUrheber),
      deps.kos,
    ),
  );
  const impacts: ImpactNotice[] = alleImpacts
    .filter((im) => !im.nurUrheber || sichtbareUrheberImpacts.has(im))
    .map(({ koId, title, at }) => ({ koId, title, at }));
  // Veröffentlichung: derselbe Filter wie bei den Zuweisungen — ein späterer Entzug wirkt sofort.
  const veroeffentlichungen = (await deps.veroeffentlichungen?.meldungenFuer(user.id)) ?? [];
  const sichtbareVeroeffentlichungen = await sichtbareEintraege(
    user,
    veroeffentlichungen,
    deps.kos,
  );
  // produkt:20261010:wissenskreislauf-schliessen: Abschluss- und Rückfragemeldungen aus dem
  // Lückenstand. Die Erfolgsmeldung prüft ihren Eintrag HEUTE gegen die Sichtbarkeit und den
  // Fachprüfstand dieses Betrachters (`AskService.gapMeldungenFuer`) — ein entzogenes Recht oder
  // eine nicht mehr nutzbare Fassung erzeugt keine. Scheitert die Ableitung, fehlen nur diese
  // Meldungen: kein Erfolg ohne Beleg, und die übrige Glocke bleibt stehen.
  const lueckenSicht = sichtbarkeitsfilterFuer(user);
  const lueckenMeldungen = await Promise.resolve()
    .then(() => deps.ask.gapMeldungenFuer(user.id, lueckenSicht))
    .catch(() => []);
  const feed = buildNotifications({
    luecken: lueckenMeldungen,
    conflicts: sichtbareKonflikte,
    overlaps: sichtbareUeberschneidungen,
    gaps: gapViews,
    assignments: sichtbareZuweisungen,
    impacts,
    kenntnisnahmen: sichtbareKenntnisnahmen,
    loeschantraege,
    reklamationen: sichtbareReklamationen,
    frische: sichtbareFrische,
    veroeffentlichungen: sichtbareVeroeffentlichungen,
  }).map((n) => ({
    ...n,
    seen: seen.has(n.id),
  }));
  // Veröffentlichung „hervorgehoben": steht oben, solange sie ungelesen ist. Die übrige Reihenfolge
  // bleibt unverändert (neueste zuerst); ohne hervorgehobene Meldung ändert sich nichts.
  const oben = (n: (typeof feed)[number]): boolean => n.hervorgehoben === true && !n.seen;
  return [...feed.filter(oben), ...feed.filter((n) => !oben(n))];
}

export function notificationsRoutes(
  deps: NotificationRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/notifications", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      // Rückgabe bleibt das bisherige Array (kompatibel) — neu ist NUR das seen-Feld je Item.
      reply.code(200).send(await loadFeed(deps, user));
    });

    // Audit-P3 (SCRUM-397): bewusstes Als-gesehen-Markieren. Idempotent; nur eigene Sicht —
    // markiert wird pro Nutzer, nie für andere. Antwort nennt den ehrlichen Rest-Stand.
    app.post("/api/notifications/seen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const body = request.body as { ids?: unknown } | null;
      const ids = Array.isArray(body?.ids)
        ? body.ids.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length === 0) {
        reply.code(400).send({ error: "ids fehlt oder leer" });
        return;
      }
      await deps.seen.markSeen(user.id, ids);
      const items = await loadFeed(deps, user);
      reply.code(200).send({ unseenCount: items.filter((n) => !n.seen).length });
    });
  };
}
