// AUFTRAG-101 (Kopfentscheidung N2 nach Preflight 98): das `lang`-Attribut an <html> ist eine
// Zusicherung ÜBER den Inhalt der Seite. Diese Datei ist die eine Wahrheit darüber:
//  · Preflight 98 hat gemessen, dass `lng` fest auf „de" steht und es weder LanguageDetector noch
//    Sprachpersistenz gibt. Der Startwert `lang="de"` in apps/web/index.html ist daher KORREKT und
//    bleibt unverändert. Der Defekt ist ein SITZUNGSdefekt: nach `changeLanguage("en")` deklariert
//    das Dokument weiterhin „de", bis neu geladen wird.
//  · Deshalb gibt es GENAU EINE Bindung an der Anwendungswurzel (main.tsx), nicht eine Pflege je
//    Sprachumschalter — es sind heute schon zwei (Topbar, Profile), und der dritte käme sonst mit
//    einer dritten Wahrheit. Dieselbe Lehre wie bei designTheme.ts.
//  · KEINE Normalisierung des Sprachcodes: `i18n.language` ist heute immer exakt „de" | „en" | „nl"
//    (festes `lng`, keine Region, kein Detector). Eine Normalisierung wäre wirkungslose Vorsorge für
//    einen Detector, den es nicht gibt — Auftrag 101 schließt sie ausdrücklich aus.
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

type SprachZuhoerer = (sprache: string) => void;

// Nur das, was diese Datei wirklich braucht — kein Import der i18n-Instanz. So bleibt der Helfer
// prüfbar, ohne das 12k-Zeilen-Wörterbuch zu laden, und main.tsx bleibt die einzige Verdrahtung.
type I18nLike = {
  language: string;
  on(event: string, listener: SprachZuhoerer): void;
  off(event: string, listener: SprachZuhoerer): void;
};

// Setzt das EINE Wurzel-Attribut. Zwei No-ops, beide bewusst:
//  · kein Dokument (node-Testumgebung, DOM-freier Renderpfad) → nichts tun, nie ein Absturz;
//  · leere Sprache → NICHT auf "" setzen, sondern den vorhandenen, korrekten Startwert stehen
//    lassen. Eine leere Deklaration wäre schlechter als die statische aus index.html.
export function applyHtmlLang(sprache: string): void {
  if (sprache === "") {
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
