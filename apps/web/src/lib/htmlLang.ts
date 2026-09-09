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
//    JOB 3323 (08.09.2026) hat den nächsten Umschalter gebracht — `components/SprachSchalter.tsx`
//    im Konto-Menü der Hülle, erreichbar aus jeder laufenden Szene — und genau NICHTS an dieser
//    Datei geändert: er ruft `i18n.changeLanguage` wie die beiden anderen, die eine Bindung an der
//    Wurzel trägt ihn mit. Das ist der Beleg dafür, dass die Lehre oben trägt; hätte jeder
//    Umschalter seine eigene Bindung, stünden hier jetzt drei.
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

// ==================================================================================================
// JOB 3323 — DER EINTRITT MIT SPRACHE (`?lang=…`), aus JOB 3280.
// ==================================================================================================
//
// Klara (das Word-Add-in) verlinkt einen gesicherten Entwurf als
// `/capture/frontdoor?draft=<id>&lang=en|de` (JOB 3280). Wer aus einem englischen Word kommt, soll
// die Anwendung auf Englisch vorfinden — und zwar SOFORT, nicht nach einem sichtbaren Umschlag.
//
// DESHALB WIRD DAS HIER GELESEN UND IN `i18n.ts` ALS `lng` GESETZT, nicht in einem Effekt der
// Oberfläche. Ein Effekt liefe erst NACH dem ersten Zeichnen: die Seite stünde einen Wimpernschlag
// auf Deutsch da und spränge dann um. Als Startwert gibt es diesen Sprung nicht.
//
// DIE ADRESSE SELBST WIRD NICHT ANGETASTET: `?draft=<id>` bleibt stehen, wird von hier weder
// gelesen noch entfernt, und `Blatt.tsx` findet ihn beim Aufbau wie bisher (`searchParams.get`).
//
// DER PARAMETER IST FÜR DEN TEST DA. Ohne Argument liest die Funktion die laufende Adresse — so
// ruft `i18n.ts` sie. Mit Argument ist sie eine reine Funktion und ohne Browser prüfbar.

// ==================================================================================================
// DER LINKVERTRAG — WAS EIN FREMDER LINK SAGEN DARF. NICHT DASSELBE WIE „WAS DIE APP KANN".
// ==================================================================================================
//
// JOB 3323 RUNDE 3, bens Korrekturpflicht 1. Runde 2 hat hier `ERLAUBTE_SPRACHEN` benutzt und damit
// auch `?lang=nl` angenommen — mit dem Argument, eine zweite Liste wäre eine zweite Wahrheit. Das
// war falsch, und zwar zweifach:
//   · VERBINDLICH: die Nachführung 2026-09-09T00:21 (aus JOB 3280) vereinbart „nur zulässige Werte
//     de|en". Eine Vorgabe wird nicht durch eine Bauüberlegung überstimmt.
//   · SACHLICH: es sind ZWEI VERSCHIEDENE TATSACHEN, nicht eine doppelt aufgeschriebene.
//     `ERLAUBTE_SPRACHEN` sagt, was die ANWENDUNG kann (de|en|nl — was unter /profil und im
//     Konto-Menü wählbar ist). Diese Liste hier sagt, was ein LINK VON AUSSEN setzen darf. Das ist
//     eine Schnittstellenzusage gegenüber Klara und darf enger sein: Klara schickt genau diese
//     beiden Werte, und was von aussen kommt, wird eng geprüft und nicht großzügig ausgelegt.
//
// DASS DIE BEIDEN LISTEN NICHT AUSEINANDERLAUFEN, ist gemessen und nicht gehofft: der Teilmengenfall
// in `tests/app-sprachschalter/standard-und-gespeicherte-wahl.test.tsx` (E3) hält fest, dass jeder
// Wert hier auch in `ERLAUBTE_SPRACHEN` steht. Ein `fr` liesse sich also nicht still eintragen.
//
// Kommt Klara eines Tages mit Niederländisch, ist das eine Zeile — und eine Entscheidung, die dann
// jemand trifft, statt sie hier vorweggenommen zu finden.
export const EINTRITT_SPRACHEN: readonly string[] = ["de", "en"];

// Was NICHT im Linkvertrag steht (`?lang=nl`, `?lang=xx`, leer, fehlend), gilt als nicht gesagt:
// die Vorgabe bleibt stehen, es gibt keinen Absturz und keine Zurechtbiegung — dieselbe Regel wie
// in `applyHtmlLang` und `gespeicherteSprache`. Ein ignoriertes `lang` nimmt dem Eintritt NICHTS
// ausser der Sprache: `?draft=<id>` wird weiterhin geöffnet.
export function sprachAusEintritt(suche?: string): string | null {
  const roh =
    suche ?? (globalThis as unknown as { location?: { search?: string } }).location?.search ?? "";
  const wert = new URLSearchParams(roh).get("lang");
  if (wert === null || !EINTRITT_SPRACHEN.includes(wert)) {
    return null;
  }
  return wert;
}

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
