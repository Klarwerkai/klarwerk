// AUFTRAG-101 (Kopfentscheidung N2 nach Preflight 98): das `lang`-Attribut an <html> ist eine
// Zusicherung ÜBER den Inhalt der Seite. Diese Datei ist die eine Wahrheit darüber:
//  · Preflight 98 hat gemessen, dass `lng` fest auf „de" steht. Der Startwert `lang="de"` in
//    apps/web/index.html blieb daher unverändert; der Defekt war ein SITZUNGSdefekt: nach
//    `changeLanguage("en")` deklarierte das Dokument weiterhin „de", bis neu geladen wurde.
//    JOB 3086 (05.09.2026) hat die Hälfte dieser Messung überholt: eine SPRACHPERSISTENZ gibt es
//    jetzt (`sprachwahl.ts`, Schlüssel `kw.sprache`), `lng` ist nicht mehr fest verdrahtet. Der
//    statische Startwert in index.html bleibt trotzdem richtig, denn er gilt nur für den Erststart
//    ohne gespeicherte Wahl — und die Vorgabe ist weiterhin „de".
//  · Deshalb gibt es GENAU EINE Bindung an der Anwendungswurzel (main.tsx), nicht eine Pflege je
//    Sprachumschalter. Als Auftrag 101 das schrieb, waren es zwei (Topbar, Profile); die Topbar
//    ist seit `e686f93` weg, es ist heute nur noch `Profile.tsx`. Die Lehre bleibt: der nächste
//    Umschalter käme sonst mit einer zweiten Wahrheit. Dieselbe Lehre wie bei designTheme.ts —
//    und aus demselben Grund wohnt auch das SCHREIBEN der Wahl an der Wurzel (`sprachwahl.ts`).
//  · KEINE Normalisierung des Sprachcodes: `i18n.language` ist weiterhin immer exakt „de" | „en" |
//    „nl". Der tragende Grund ist seit JOB 3086 nicht mehr das feste `lng`, sondern die Prüfung:
//    die gespeicherte Wahl wird gegen ERLAUBTE_SPRACHEN (unten) geprüft, BEVOR sie `lng` wird, und
//    einen LanguageDetector gibt es nach wie vor NICHT — also entsteht auch keine Region. Eine
//    Normalisierung wäre wirkungslose Vorsorge für einen Detector, den es nicht gibt — Auftrag 101
//    schließt sie ausdrücklich aus, und JOB 3086 hat daran nichts geändert.
// DOM-frei (globalThis, strukturelle Typen statt lib.dom) — importierbar aus node-env-Tests.

// Der Ereignisname steht GENAU EINMAL. i18next typisiert `on("languageChanged", …)` eng, `off` aber
// nur als `off(event: string, …)` (index.d.ts:431 vs. 442) — ein Tippfehler in der Abmeldung wäre
// also still. Eine geteilte Konstante nimmt dem Typsystem diese Lücke ab.
export const I18N_LANGUAGE_CHANGED_EVENT = "languageChanged";
export const HTML_LANG_ATTRIBUTE = "lang";

// Strukturell statt lib.dom (Klarwerk-Regel: lib-Helfer kompilieren auch im DOM-freien Typkontext).
type DocumentLike = {
  documentElement: {
    setAttribute(name: string, value: string): void;
  };
};

export type SprachZuhoerer = (sprache: string) => void;

// Nur das, was diese Datei wirklich braucht — kein Import der i18n-Instanz. So bleibt der Helfer
// prüfbar, ohne das 12k-Zeilen-Wörterbuch zu laden, und main.tsx bleibt die einzige Verdrahtung.
//
// JOB 3086: exportiert, weil `sprachwahl.ts` an derselben Instanz dieselben drei Bausteine braucht.
// Ein zweiter, gleichlautender Typ dort wäre eine zweite Wahrheit über dieselbe Schnittstelle.
export type I18nLike = {
  language: string;
  on(event: string, listener: SprachZuhoerer): void;
  off(event: string, listener: SprachZuhoerer): void;
};

// Die erlaubte Menge steht GENAU EINMAL — dieselbe Lehre wie beim Ereignisnamen darüber. Der
// Vertragstest führt sie nicht als eigene Liste, sondern prüft diese hier (Fall 14): eine später
// erweiterte Menge fällt dadurch auf, statt still mitzulaufen.
//
// WARUM EINE ERLAUBTE MENGE UND KEINE NORMALISIERUNG: Ownerentscheidung zu JOB 536 vom 13.08.2026
// (`00_CONTROL/ENTSCHEIDUNGEN/JOB-536.md`) — „genau `de|en|nl` zulassen, alles andere als No-op
// behandeln, ausdrücklich nicht normalisieren". Das ist kein Widerspruch zur Notiz im Dateikopf:
// dort ist die NORMALISIERUNG ausgeschlossen (aus `de-DE` würde `de`), nicht die Prüfung. `de-DE`
// wird deshalb nicht zurechtgebogen, sondern gar nicht erst geschrieben.
export const ERLAUBTE_SPRACHEN: readonly string[] = ["de", "en", "nl"];

// Setzt das EINE Wurzel-Attribut. Zwei No-ops, beide bewusst:
//  · kein Dokument (node-Testumgebung, DOM-freier Renderpfad) → nichts tun, nie ein Absturz;
//  · jede Sprache ausserhalb der erlaubten Menge → den vorhandenen, korrekten Wert stehen lassen.
//    Das schliesst die leere Sprache ein: "" steht nicht in der Menge, und eine leere Deklaration
//    wäre schlechter als die statische aus index.html. Die frühere gesonderte Leerprüfung ist
//    darin aufgegangen — zwei Prüfungen für dieselbe Zusicherung wären eine zu viel.
export function applyHtmlLang(sprache: string): void {
  if (!ERLAUBTE_SPRACHEN.includes(sprache)) {
    return;
  }
  const doc = (globalThis as unknown as { document?: DocumentLike }).document;
  if (!doc) {
    return;
  }
  doc.documentElement.setAttribute(HTML_LANG_ATTRIBUTE, sprache);
}

// Beim App-Start (main.tsx): aktuellen Stand setzen UND auf jeden weiteren Wechsel hören.
// Beides zusammen — nur zu hören verpasst den Start, nur zu setzen verpasst genau den Defekt,
// wegen dem diese Datei existiert.
//
// Rückgabe ist die Abmeldung. Im Produktivbetrieb hat sie keinen Adressaten (die Anwendungshülle
// wird nie ausgehängt); gebraucht wird sie im TEST, wo mehrere Fälle gegen dieselbe i18n-Instanz
// laufen und sich Zuhörer sonst über Fälle hinweg anhäufen. Sie ist idempotent: ein zweiter Aufruf
// meldet nicht versehentlich einen inzwischen neu registrierten Zuhörer ab.
export function bindHtmlLang(i18n: I18nLike): () => void {
  const zuhoerer: SprachZuhoerer = (sprache) => {
    applyHtmlLang(sprache);
  };
  applyHtmlLang(i18n.language);
  i18n.on(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);

  let abgemeldet = false;
  return () => {
    if (abgemeldet) {
      return;
    }
    abgemeldet = true;
    i18n.off(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);
  };
}
