import type { GapView } from "../../ask";
import type { Conflict, OverlapEntry } from "../../conflicts";
import type { AssignmentNotice } from "../../validation";

// In-App-Benachrichtigungen (Abstimmpunkt 2). Das notifications-Modul versendet
// nur E-Mail; die Glocke/Popover-Quelle wird hier aus vorhandenen Signalen mit
// Zeitstempel aggregiert: offene Konflikte, offene Wissenslücken und — SCRUM-363 —
// die persönlichen offenen Review-Zuweisungen der aktuellen Person.
export type NotificationKind = "conflict" | "duplicate" | "gap" | "assignment" | "impact";

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
}): Notification[] {
  const items: Notification[] = [];
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
    items.push({
      id: `con-${c.id}`,
      kind: "conflict",
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
    items.push({
      id: `assign-${a.koId}`,
      kind: "assignment",
      title: a.title,
      at: a.at,
      koId: a.koId,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
