// JOB 3065 H6 — WAS EINE ROLLE DARF, ABGELEITET STATT ERFUNDEN.
//
// Die ROLLEN-Karte nennt zu jeder Rolle ihre Freiheiten. Diese Freiheiten stehen NICHT als freier
// Text in der Oberfläche, sondern entstehen aus der einzigen Quelle, die sie wirklich kennt:
// `app/navigation.ts` (`minRole` je Eintrag) und `lib/adminSections.ts` (die Reiter, die ein Admin
// bekommt).
//
// DIE REGEL: Die Freiheiten einer Rolle sind die Stichwörter der Einträge, die GENAU BEI IHR neu
// dazukommen (`minRole === Rolle`). Jeder Eintrag trägt unten sein Stichwort — mehrere Einträge
// dürfen sich eins teilen (Prüfen, Risiko & Lücken und Lebenszyklus sind DIE EINE Prüfarbeit des
// Controllers), und ein Eintrag darf ausdrücklich KEINS haben (`null`): Start, Hilfe und Profil hat
// jede Rolle, sie beschreiben keine Freiheit.
//
// DIE ABSICHERUNG: Die Zuordnung ist VOLLSTÄNDIG über alle bewachten Einträge. Kommt in
// `navigation.ts` ein Eintrag hinzu, fehlt hier sein Stichwort und
// `tests/app/h6-rollenfreiheiten.test.ts` wird rot — die Karte kann also nicht still veralten.
import { ALL_ITEMS, EXTRA_GUARDED_ITEMS, type Role, roleAllows } from "../../app/navigation";
import { ADMIN_SECTIONS } from "../../lib/adminSections";

/** Alle Einträge mit Rollen-Gate — Navigationseinträge plus die bewachten Deep-Links. */
export const BEWACHTE_EINTRAEGE = [...ALL_ITEMS, ...EXTRA_GUARDED_ITEMS];

/**
 * Ein Stichwort je bewachtem Eintrag, als i18n-Schlüssel. `null` = dieser Eintrag beschreibt keine
 * Freiheit einer Rolle (jede Rolle hat ihn).
 */
export const STICHWORT_JE_EINTRAG: Record<string, string | null> = {
  // Betrachter
  start: null, // die Startseite hat jede Rolle
  hilfe: null, // Hilfe hat jede Rolle
  profil: null, // das eigene Konto hat jede Rolle
  fragen: "einst.rollen.wort.fragen",
  bibliothek: "einst.rollen.wort.lesen",
  wissensnetz: "einst.rollen.wort.lesen",
  extern: "einst.rollen.wort.lesen",
  // Experte — „Meine Aufgaben" ist die Nacharbeitsliste der eigenen Erfassung, kein zweites Recht.
  aufgaben: "einst.rollen.wort.erfassen",
  erfassen: "einst.rollen.wort.erfassen",
  captureFrontDoor: "einst.rollen.wort.erfassen",
  // Controller — Prüfen, Risiko & Lücken und Lebenszyklus sind dieselbe Prüfarbeit.
  validierung: "einst.rollen.wort.pruefen",
  risiko: "einst.rollen.wort.pruefen",
  lebenszyklus: "einst.rollen.wort.pruefen",
  konflikte: "einst.rollen.wort.konflikte",
  conflictCompare: "einst.rollen.wort.konflikte",
  duplikate: "einst.rollen.wort.duplikate",
  duplicateCompare: "einst.rollen.wort.duplikate",
  // Admin — die Auswertungen und die Stufe-2-Flächen arbeiten alle am eigenen Datenbestand.
  analytics: "adm.sec.daten",
  output: "adm.sec.daten",
  import: "adm.sec.daten",
  graph: "adm.sec.daten",
  kapital: "adm.sec.daten",
  // Der Eintrag „/admin" IST diese Fläche — seine Freiheiten sind ihre Reiter (adminSections.ts).
  admin: "@einstellungen",
};

/** Feste Reihenfolge der Stichwörter (sonst entschiede die Reihenfolge der Navigation). */
const WORT_ORDNUNG: readonly string[] = [
  "einst.rollen.wort.fragen",
  "einst.rollen.wort.lesen",
  "einst.rollen.wort.erfassen",
  "einst.rollen.wort.pruefen",
  "einst.rollen.wort.konflikte",
  "einst.rollen.wort.duplikate",
  ...ADMIN_SECTIONS.map((s) => s.labelKey),
];

/** Die Einträge, die GENAU bei dieser Rolle neu dazukommen. */
export function eintraegeFuer(rolle: Role): string[] {
  return BEWACHTE_EINTRAEGE.filter((i) => i.minRole === rolle).map((i) => i.id);
}

/**
 * Die Stichwort-Schlüssel dieser Rolle, ohne Dubletten, in fester Reihenfolge.
 * `@einstellungen` löst sich in die Reiter dieser Fläche auf.
 */
export function freiheitenSchluessel(rolle: Role): string[] {
  const roh = new Set<string>();
  for (const id of eintraegeFuer(rolle)) {
    const wort = STICHWORT_JE_EINTRAG[id];
    if (wort === null || wort === undefined) {
      continue;
    }
    if (wort === "@einstellungen") {
      for (const s of ADMIN_SECTIONS) {
        roh.add(s.labelKey);
      }
      continue;
    }
    roh.add(wort);
  }
  return WORT_ORDNUNG.filter((w) => roh.has(w));
}

/**
 * Darf diese Rolle die KI frei wählen? Heute entscheidet das allein das bestehende Rollenmodell:
 * die KI-Zuordnung liegt auf dieser Fläche, und die steht hinter `minRole` des Eintrags „/admin".
 * (Pedi 04.09.: je Rolle freischaltbar und im Nutzerprofil hinterlegt — das ist ein eigener
 * Auftrag; hier wird NUR angezeigt, was das heutige Modell hergibt.)
 */
export function kiWahlFrei(rolle: Role): boolean {
  const eintrag = ALL_ITEMS.find((i) => i.id === "admin");
  return eintrag !== undefined && roleAllows(eintrag, rolle);
}
