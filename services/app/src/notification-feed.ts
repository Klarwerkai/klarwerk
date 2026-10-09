import type { GapView } from "../../ask";
import type { Conflict, OverlapEntry } from "../../conflicts";
import type { AssignmentNotice } from "../../validation";

// In-App-Benachrichtigungen (Abstimmpunkt 2). Das notifications-Modul versendet
// nur E-Mail; die Glocke/Popover-Quelle wird hier aus vorhandenen Signalen mit
// Zeitstempel aggregiert: offene Konflikte, offene Wissenslücken und — SCRUM-363 —
// die persönlichen offenen Review-Zuweisungen der aktuellen Person.
// R-0894: `escalation` (eskalierter Wahrheitskonflikt) und `return` (Rückgabe zur Nacharbeit an die
// verantwortliche Person) sind eigene Arten — vorher liefen sie als gewöhnlicher Konflikt bzw. als
// „Review für dich" mit dem Sprungziel der Prüfliste.
export type NotificationKind =
  | "conflict"
  | "escalation"
  | "duplicate"
  | "gap"
  | "assignment"
  | "return"
  | "impact"
  | "kenntnisnahme"
  // aufnahme:20260922:gesamt-wissen-frische: persönliche Zustellung an die verantwortliche Person —
  // Fristerinnerung (R-0248), wöchentliche Vorlage (R-0266), Prüfanforderung nach Anlagenänderung
  // an Autor bzw. Nachfolger (R-1635). Die Unterart steht in `frischeArt`.
  | "frische"
  | "reklamation"
  | "veroeffentlichung";

// R-1089: eine Meldung „Antwort falsch / Quelle passt nicht" an die verantwortliche Person des
// zitierten Wissensobjekts. Quelle: Audit-Einträge `answer.reported`, deren `responsible` der
// Betrachter ist. Wer gemeldet hat, steht NICHT darin — die Meldung ist ein Hinweis an das Objekt,
// keine Anzeige gegen eine Person; der Fragetext reist ebenfalls nicht mit.
export interface ReklamationNotice {
  meldungId: string;
  koId: string;
  title: string;
  grund: "antwort-falsch" | "quelle-passt-nicht";
  at: string;
}

/** aufnahme:20260922:gesamt-wissen-frische — eine persönliche Frische-Meldung (s. frische-meldungen.ts). */
export interface FrischeNotice {
  art: "frist" | "vorlage" | "anlage";
  /** Eindeutig je Anlass — ein neuer Anlass (neue Frist, neue Woche, neue Markierung) ist ungelesen. */
  schluessel: string;
  koId: string;
  title: string;
  at: string;
  /** Nur bei `frist`: die Haltbarkeit ist bereits abgelaufen. */
  ueberfaellig?: boolean;
}

// Veröffentlichung (produkt:20261007:veroeffentlichungsoptionen): eine bei „normal" oder
// „hervorgehoben" veröffentlichte Fassung, deren Empfängerkreis die aktuelle Person enthält. Bereits
// auf den Betrachter und über die Sichtbarkeit gefiltert (Route) — „still" kommt hier nie an.
export interface VeroeffentlichungNotice {
  vermerkId: string;
  koId: string;
  title: string;
  fassung: number;
  art: "neu" | "aktualisierung";
  hervorgehoben: boolean;
  at: string;
}

// Kenntnisnahme: eine offene Anforderung an die aktuelle Person. Bereits auf den Betrachter UND
// über die Sichtbarkeit gefiltert (Route) — hier wird nichts nachgeprüft und nichts erfunden.
export interface KenntnisnahmeNotice {
  anforderungId: string;
  koId: string;
  title: string;
  fassung: number;
  at: string;
  erinnerung: boolean;
  ueberfaellig: boolean;
}

// PMO-FEA-0002: Wirkungs-Rückmeldung an den Originalautor („Dein Wissen hat geholfen").
// Quelle: Audit-Einträge answer.helpful — keine eigene Persistenz, keine Zähler/Scores.
export interface ImpactNotice {
  koId: string;
  title: string;
  at: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
  // SCRUM-363: bei Zuweisungen das Quell-KO (für Anzeige/Verlinkung); sonst nicht gesetzt.
  koId?: string;
  // FUNKE-FIX3 P0 (bens Blocker B): true → der Titel (Gap-Fragetext) wurde für diesen Betrachter
  // zurückgehalten; der Client zeigt eine neutrale Bezeichnung (DE/EN/NL), NIE den Fragetext.
  // JOB 1125: gilt jetzt genauso für `conflict` (description) und `duplicate` (Modell-Begründung).
  // Die Bedeutung ist in allen drei Fällen dieselbe — Titel leer, Neutralbezeichnung im Client.
  redacted?: boolean;
  // Kenntnisnahme: die angeforderte Fassung, ob es eine Erinnerung ist und ob die Frist verstrichen
  // ist. Nur bei `kind: "kenntnisnahme"` gesetzt.
  fassung?: number;
  erinnerung?: boolean;
  ueberfaellig?: boolean;
  // R-1089: Meldegrund und Meldungsnummer (dieselbe, die der Meldende quittiert bekam). Nur bei
  // `kind: "reklamation"` gesetzt.
  grund?: ReklamationNotice["grund"];
  meldungId?: string;
  // aufnahme:20260922:gesamt-wissen-frische: die Unterart einer `frische`-Meldung.
  frischeArt?: FrischeNotice["art"];
  // Veröffentlichung: neu oder Aktualisierung, und ob sie hervorgehoben gemeldet wurde. Nur bei
  // `kind: "veroeffentlichung"` gesetzt (`fassung` trägt dort die veröffentlichte Fassung).
  art?: "neu" | "aktualisierung";
  hervorgehoben?: boolean;
}

// SCRUM-363 / AG-15: persönliche offene Review-Zuweisungen kommen als eigene Kategorie in den Feed.
// `assignments` enthält bereits NUR die Zuweisungen der aktuellen Person (Route filtert pro Nutzer) —
// hier wird keine Ownership erfunden. Konflikt-/Gap-Benachrichtigungen bleiben unverändert.
// FUNKE-FIX3 P0 (bens Blocker B): `gaps` sind bereits die BETRACHTERGERECHT redigierten Sichten aus
// dem zentralen Sichtbarkeitsvertrag (gap-visibility.redactGapForViewer) — NIE rohe
// AskService.listGaps()-Objekte. Bei redacted bleibt der Titel leer (fail-closed, selbst wenn ein
// Aufrufer versehentlich einen Fragetext mitgibt); der Client zeigt dann die Neutralbezeichnung.
export function buildNotifications(input: {
  // JOB 1125: `& { redacted?: boolean }` ist ADDITIV — eine rohe `Conflict[]`/`OverlapEntry[]`
  // passt unverändert weiter hinein. Der Feed KANN dadurch die redigierten Sichten aus
  // `sichtbarkeit.redigiereKonflikt`/`redigiereUeberschneidung` entgegennehmen und respektiert
  // sie, wenn er sie bekommt. Er erfindet die Redaktion nicht selbst: der Betrachter ist hier
  // nicht bekannt, und eine zweite Auslegung der Sichtbarkeitsregel an dieser Stelle wäre genau
  // die Bauart, gegen die `sichtbarkeit.ts` geschrieben ist.
  conflicts: (Conflict & { redacted?: boolean })[];
  gaps: GapView[];
  assignments?: AssignmentNotice[];
  impacts?: ImpactNotice[];
  // Pedi 04.07.: offene Überschneidungen (Duplikate) erscheinen wie Konflikte in der Glocke, damit
  // ein neuer Fund auch ohne Besuch der Duplikate-Seite auffällt.
  overlaps?: (OverlapEntry & { redacted?: boolean })[];
  kenntnisnahmen?: KenntnisnahmeNotice[];
  reklamationen?: ReklamationNotice[];
  // aufnahme:20260922:gesamt-wissen-frische: bereits auf den Betrachter UND die Sichtbarkeit
  // beschränkt (Route) — hier wird nichts nachgeprüft und nichts erfunden.
  frische?: FrischeNotice[];
  veroeffentlichungen?: VeroeffentlichungNotice[];
}): Notification[] {
  const items: Notification[] = [];
  for (const r of input.reklamationen ?? []) {
    items.push({
      id: `rek-${r.meldungId}`,
      kind: "reklamation",
      title: r.title,
      at: r.at,
      koId: r.koId,
      grund: r.grund,
      meldungId: r.meldungId,
    });
  }
  for (const f of input.frische ?? []) {
    items.push({
      id: `frische-${f.schluessel}`,
      kind: "frische",
      title: f.title,
      at: f.at,
      koId: f.koId,
      frischeArt: f.art,
      ...(f.ueberfaellig ? { ueberfaellig: true } : {}),
    });
  }
  for (const v of input.veroeffentlichungen ?? []) {
    items.push({
      id: `pub-${v.vermerkId}`,
      kind: "veroeffentlichung",
      title: v.title,
      at: v.at,
      koId: v.koId,
      fassung: v.fassung,
      art: v.art,
      hervorgehoben: v.hervorgehoben,
    });
  }
  // Je Anforderung EIN Eintrag. Eine Erinnerung bekommt eine neue Kennung (mit ihrem Zeitpunkt),
  // damit sie wieder als ungelesen erscheint — sie ersetzt den Eintrag, statt einen zweiten
  // daneben zu stellen.
  for (const k of input.kenntnisnahmen ?? []) {
    items.push({
      id: k.erinnerung ? `kn-${k.anforderungId}-${k.at}` : `kn-${k.anforderungId}`,
      kind: "kenntnisnahme",
      title: k.title,
      at: k.at,
      koId: k.koId,
      fassung: k.fassung,
      erinnerung: k.erinnerung,
      ueberfaellig: k.ueberfaellig,
    });
  }
  for (const im of input.impacts ?? []) {
    items.push({
      id: `impact-${im.koId}-${im.at}`,
      kind: "impact",
      title: im.title,
      at: im.at,
      koId: im.koId,
    });
  }
  for (const c of input.conflicts) {
    // JOB 1125: `description` beschreibt den Widerspruch zwischen beiden Aussagen — bei redigiertem
    // Konflikt bleibt der Titel leer und der Marker trägt die Aussage.
    // R-0894: ein eskalierter Konflikt bekommt eine eigene Kennung — die Eskalation ist neu, auch
    // wenn der Konflikt vorher schon gesehen war, und erscheint deshalb wieder als ungelesen.
    const eskaliert = c.status === "eskaliert";
    items.push({
      id: eskaliert ? `esc-${c.id}` : `con-${c.id}`,
      kind: eskaliert ? "escalation" : "conflict",
      title: c.redacted ? "" : c.description,
      at: c.createdAt,
      ...(c.redacted ? { redacted: true } : {}),
    });
  }
  for (const o of input.overlaps ?? []) {
    // Titel: die Modell-Begründung (selbsterklärend), sonst ein kurzer Fallback für den
    // deterministischen (textgleichen) Fund. Die Glocke setzt „Mögliches Duplikat:" davor.
    //
    // JOB 1125: dieselbe Behandlung wie bei den Wissenslücken unten. Die Begründung fasst BEIDE
    // Objekte zusammen und ist der am weitesten hinausreichende dieser Texte — sie steht in der
    // Glocke auf jeder Seite der Anwendung. Ist der Eintrag redigiert
    // (sichtbarkeit.redigiereUeberschneidung), bleibt der Titel LEER und der Marker sagt es:
    // fail-closed selbst dann, wenn ein Aufrufer versehentlich einen Rohtext mitgibt. Der
    // Fallbacktext wäre hier kein Ersatz, sondern eine Aussage über den Fund („überschneiden sich
    // stark") — deshalb entfällt auch er.
    items.push({
      id: `dup-${o.id}`,
      kind: "duplicate",
      title: o.redacted
        ? ""
        : o.detector?.rationale?.trim() || "Zwei Beiträge überschneiden sich stark.",
      at: o.createdAt,
      ...(o.redacted ? { redacted: true } : {}),
    });
  }
  for (const g of input.gaps) {
    if (g.status === "offen") {
      items.push({
        id: `gap-${g.id}`,
        kind: "gap",
        title: g.redacted ? "" : g.question,
        at: g.createdAt,
        ...(g.redacted ? { redacted: true } : {}),
      });
    }
  }
  for (const a of input.assignments ?? []) {
    // R-0894: eine Rückgabe trägt ihren Zeitpunkt in der Kennung — eine zweite Rückgabe desselben
    // Objekts ist ein neuer, ungelesener Hinweis.
    items.push({
      id: a.rueckgabe ? `ret-${a.koId}-${a.at}` : `assign-${a.koId}`,
      kind: a.rueckgabe ? "return" : "assignment",
      title: a.title,
      at: a.at,
      koId: a.koId,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
