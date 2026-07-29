import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// AUFTRAG-mega52 BLOCK C3 — DER SAMMLER FÜR DIE VALIDIERT-ZUSICHERUNG.
// ================================================================================================
//
// DER VORFALL (Pedi, Word-Handlauf 28.07., P0). `ask.intro` versprach wörtlich: „Antworten kommen
// ausschließlich aus validiertem Wissen." Der Session-Weg setzt `validatedOnly` aber NICHT — die
// Option existiert nur im Add-on- und `retrieval-only`-Zweig; die Weboberfläche ruft
// `answer(user.id)` ohne Optionen. Der Widerspruch stand im Repo selbst schon nebeneinander:
// `ask.contract.unverified.body` gibt es, WEIL unvalidierte Antworten der Normalfall sind.
//
// DIE ENTSCHEIDUNG DES KOPFES (mega52 C, ausdrücklich begründet): nicht den Filter auf „nur
// validiert" nachziehen, sondern den TEXT auf die Wahrheit. Ein Validiert-Filter würde bei frischem
// Bestand fast jede Frage zur Wissenslücke machen; das tragende Versprechen ist ohnehin ein
// anderes — „du siehst, worauf die Antwort steht, und in welchem Zustand diese Quellen sind"
// (Block A). Dieser Sammler hütet, dass der Text nicht wieder davonläuft.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM, NICHT DIE LISTE DER HEUTIGEN FUNDSTELLEN. Es steht hier bewusst keine Aufzählung der
// sieben Schlüssel, die am 29.07. betroffen waren. Der Sammler erhebt in zwei voneinander
// unabhängigen Stufen — die eine über den TEXT, die andere über den CODE:
//
//   (1) DIE ZUSICHERUNG wird an der Aussage selbst erkannt, nicht an einer Markierung, die jemand
//       freiwillig setzt. Ein Anzeigetext behauptet sie genau dann, wenn er DREI Dinge zugleich
//       tut: er spricht über die ANTWORT, er sagt AUSSCHLIESSLICH, und er sagt VALIDIERT. Das ist
//       keine Konvention — das IST der Satz. Erhoben wird über alle drei Sprachblöcke des i18n und
//       über die im deutschen UI aktiven FAQ-Texte (`lib/faqContent.ts`, bewusst nicht im i18n).
//       Deshalb greift die Regel auch bei einem Schlüssel, den es heute noch nicht gibt.
//
//   (2) DAS URTEIL kommt aus dem PRODUKTCODE, nicht aus dieser Datei: setzt der Session-Antwortweg
//       `validatedOnly`? Gelesen wird das an der einen Stelle, an der es entschieden wird —
//       `services/app/src/routes/ask-routes.ts`. Zieht jemand den Filter morgen WIRKLICH nach, wird
//       dieser Sammler von selbst nachsichtig; er verlangt nie mehr, als der Code hergibt. Genau
//       das meint C3 mit „nur zulässig, wenn der zugehörige Weg `validatedOnly` tatsächlich setzt".
//
// WARUM DIE ANTWORT-WENDUNG DAS UNTERSCHEIDUNGSMERKMAL IST. Die Aussage „für ein Dokument kommen
// nur geprüfte Wissensobjekte infrage" (`shelp.out.sourcesTitle`, `help.stufe2.body`) ist WAHR —
// der Output-Weg lehnt nicht-validierte Objekte hart ab (`services/output/src/service.ts`). Sie
// darf deshalb stehen bleiben. Ein Sammler, der stumpf auf „ausschließlich" + „validiert" prüft,
// würde sie fälschlich rot färben und wäre nach zwei Tagen abgeschaltet. Der Unterschied liegt
// nicht in einer Namensraum-Tabelle, die jemand pflegen muss, sondern im Satz: der eine spricht
// über die Antwort, der andere über das Dokument.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//
//  1. UMSCHREIBUNG GREIFT. Ein Text, der dieselbe Zusage ohne diese Wortstämme macht („die Antwort
//     stammt aus abgesichertem Bestand"), fällt durch. Die Stammlisten unten sind bewusst breit —
//     sie decken die drei Sprachen und die gängigen Synonyme —, aber sie sind endlich.
//  1b. ÜBER ZWEI SÄTZE VERTEILT GREIFT AUCH. Gemessen wird je SATZ (Begründung unten am Muster).
//     „Antworten sind quellengebunden. Wir nutzen nur Geprüftes." wäre in Summe dieselbe Zusage,
//     steht aber in zwei Sätzen und fällt durch. Der Satz ist die kleinste Einheit, in der eine
//     Behauptung sicher als solche erkennbar ist — die größere Einheit erkauft Trefferquote mit
//     Falschalarmen, die den Wächter unbrauchbar machen (s. Muster).
//  2. SIE LIEST TEXT, KEINE ANZEIGE. Ob ein Schlüssel überhaupt gerendert wird, steht hier nicht
//     zur Debatte. Das ist Absicht: ein verwaister Schlüssel mit falschem Versprechen ist eine
//     scharfe Waffe, sobald ihn jemand wieder einbindet.
//  3. DAS URTEIL IST GROBKÖRNIG. Gelesen wird, ob der Session-Zweig der Ask-Route `validatedOnly`
//     setzt — nicht, ob ein tieferliegender Weg zufällig doch filtert. Für die Frage „darf der Text
//     das versprechen?" ist genau diese Stelle die richtige: sie ist die Weiche.
//  4. NUR DE/EN/NL. Eine vierte Oberflächensprache wäre nicht Gegenstand, bis ihre Stämme hier
//     stehen — sichtbar an dieser Aufzählung, nicht still.
// ================================================================================================

const WURZEL = process.cwd();
const I18N = join("apps", "web", "src", "i18n.ts");
const FAQ = join("apps", "web", "src", "lib", "faqContent.ts");
const ASK_ROUTE = join("services", "app", "src", "routes", "ask-routes.ts");

// ── Stufe 2: das Urteil aus dem Produktcode ──────────────────────────────────────────────────────
//
// Der Session-Zweig ist der Aufruf OHNE Optionen (`answer(user.id)`); die validierten Zweige sind
// der Add-on- und der `retrieval-only`-Pfad. Gefragt ist: filtert der SESSION-Weg auf validiert?
function sessionWegFiltertValidiert(): boolean {
  const quelle = readFileSync(join(WURZEL, ASK_ROUTE), "utf8").replace(/\/\/[^\n]*/g, "");
  // Der Session-Abschluss der Route ist der letzte, optionslose `answer(...)`-Aufruf. Trägt er
  // `validatedOnly`, gilt die Zusicherung fortan zu Recht.
  const sessionAufruf = /await answer\(\s*user\.id\s*\)/.test(quelle);
  return !sessionAufruf;
}

// ── Stufe 1: die Zusicherung am Satz erkennen ────────────────────────────────────────────────────
//
// DREI Merkmale müssen ZUSAMMEN in einem Anzeigetext stehen. Einzeln sagt keines etwas: „Antwort"
// steht überall, „ausschließlich" auch, und „validiert" ist ein legitimes Wort über Wissensobjekte.
const ANTWORT = /\b(antwort\w*|antwoord\w*|answer\w*|antwortet|antwoordt)\b/i;
const EXKLUSIV =
  /\b(ausschließlich|ausschliesslich|nur|einzig\w*|allein|erst|exclusively|only|solely|alone|uitsluitend|alleen|enkel|pas)\b/i;
const VALIDIERT =
  /\b(validiert\w*|geprüft\w*|geprueft\w*|gesichert\w*|freigegeben\w*|validated|verified|reviewed|released|secured|gevalideerd\w*|gecontroleerd\w*|geborgd\w*|vrijgegeven\w*)\b/i;

// DIE EINHEIT EINER BEHAUPTUNG IST DER SATZ, nicht der ganze Anzeigetext. Das ist keine Feinheit:
// misst man über den ganzen Text, wird jeder lange Hilfetext rot, der irgendwo „Antwort", irgendwo
// „nur" und irgendwo „geprüft" enthält — auch wenn er nichts Falsches behauptet. Ein Wächter, der
// zu sauberer Sprache zwingt, indem er sie verbietet, wird nach zwei Tagen abgeschaltet. Umgekehrt
// ist der Satz die kleinste Einheit, in der die Zusage WIRKLICH steht.
//
// Semikolon und Gedankenstrich trennen NICHT — „Validiert wird es erst durch genug Freigaben; für
// Antworten zählt es erst danach." ist eine Aussage, kein Zufall zweier Nachbarn.
function saetze(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function behauptetZusicherung(text: string): boolean {
  return saetze(text).some(
    (satz) => ANTWORT.test(satz) && EXKLUSIV.test(satz) && VALIDIERT.test(satz),
  );
}

interface Fund {
  datei: string;
  schluessel: string;
  wert: string;
}

// Liest die Anzeigewerte aus dem i18n — Schlüssel plus (ggf. mehrzeiligen) String-Wert. Kommentar-
// zeilen fallen weg; ein Kommentar ist kein Anzeigetext.
function i18nWerte(): Fund[] {
  const quelle = readFileSync(join(WURZEL, I18N), "utf8");
  const funde: Fund[] = [];
  const muster = /^ {2}"([\w.]+)":\s*\n?\s*("(?:[^"\\]|\\.)*")/gm;
  for (const m of quelle.matchAll(muster)) {
    funde.push({ datei: "apps/web/src/i18n.ts", schluessel: m[1] as string, wert: m[2] as string });
  }
  return funde;
}

// Die FAQ-Antworten leben bewusst ausserhalb des i18n (nur DE, im deutschen UI aktiv und zugleich
// Grundlage der Klara-KI-Suche) — ein Sammler, der sie auslässt, hätte am 29.07. zwei echte
// Fundstellen verschwiegen.
function faqWerte(): Fund[] {
  const quelle = readFileSync(join(WURZEL, FAQ), "utf8").replace(/^\s*\/\/[^\n]*$/gm, "");
  const funde: Fund[] = [];
  const muster = /\b(question|answer):\s*\n?\s*("(?:[^"\\]|\\.)*")/g;
  for (const m of quelle.matchAll(muster)) {
    funde.push({
      datei: "apps/web/src/lib/faqContent.ts",
      schluessel: `${m[1]}`,
      wert: m[2] as string,
    });
  }
  return funde;
}

const ALLE_TEXTE: Fund[] = [...i18nWerte(), ...faqWerte()];
const ZUSICHERUNGEN: Fund[] = ALLE_TEXTE.filter((f) => behauptetZusicherung(f.wert));

describe("mega52 C3: die Erhebung greift", () => {
  it("die Anzeigetexte werden wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    // Drei Sprachblöcke à gut 3000 Schlüssel plus die FAQ-Texte.
    expect(ALLE_TEXTE.length).toBeGreaterThan(6000);
    expect(ALLE_TEXTE.some((f) => f.datei.endsWith("faqContent.ts"))).toBe(true);

    // Positiv-Sonde am MUSTER, nicht am Bestand: der Satz, um den es ging, wird erkannt.
    expect(
      behauptetZusicherung(
        "Antworten kommen ausschließlich aus validiertem Wissen — mit Quellen und Vertrauen.",
      ),
    ).toBe(true);
    expect(
      behauptetZusicherung("Het antwoord komt uitsluitend uit gevalideerde kennis met bronnen."),
    ).toBe(true);
    expect(
      behauptetZusicherung("Answers come only from validated knowledge, with sources and trust."),
    ).toBe(true);

    // Negativ-Sonde: die WAHRE Aussage über den Output-Weg darf NICHT hineinrutschen — sie spricht
    // über Dokumente, nicht über die Antwort, und der Output-Weg filtert wirklich validiert-exklusiv.
    expect(
      behauptetZusicherung(
        "Für ein Dokument kommen nur geprüfte Wissensobjekte infrage. Was nicht validiert ist, steht bewusst nicht zur Auswahl.",
      ),
    ).toBe(false);
    // Und eine harmlose Erwähnung von „validiert" ohne Exklusivität ebenso wenig.
    expect(behauptetZusicherung("Validiertes Wissen ist nutzbar und bleibt nachvollziehbar.")).toBe(
      false,
    );
  });

  it("das Urteil kommt aus dem Produktcode, nicht aus dieser Datei", () => {
    // Kalibrierung: die Route wird wirklich gelesen und der Session-Zweig ist auffindbar. Wäre der
    // Aufruf umbenannt, stünde hier ein falsches „filtert schon" — deshalb wird beides geprüft.
    const quelle = readFileSync(join(WURZEL, ASK_ROUTE), "utf8");
    expect(quelle).toContain("validatedOnly");
    expect(quelle, "der Session-Abschluss der Ask-Route ist nicht mehr auffindbar").toMatch(
      /await answer\(\s*user\.id\s*\)/,
    );
  });
});

describe("mega52 C3: kein Text verspricht mehr, als der Weg hält", () => {
  it("eine Antwort-Exklusivitäts-Zusage gibt es nur, wenn der Weg validatedOnly setzt", () => {
    if (sessionWegFiltertValidiert()) {
      // Der Filter wurde nachgezogen — dann darf der Text es auch sagen. Der Sammler bleibt
      // lebendig: er misst weiter am Code, nicht an einer Momentaufnahme.
      return;
    }
    const wortlaut = ZUSICHERUNGEN.map((f) => `${f.datei} · ${f.schluessel}: ${f.wert}`);

    expect(
      wortlaut,
      "Diese Anzeigetexte sichern zu, dass die Antwort AUSSCHLIESSLICH aus validiertem/geprüftem " +
        "Wissen kommt — der Session-Antwortweg setzt `validatedOnly` aber nicht (ask-routes.ts " +
        "ruft `answer(user.id)` ohne Optionen). Entweder der Weg filtert wirklich, oder der Text " +
        "sagt, was der Weg tut: quellengebunden, mit sichtbarem Zustand jeder Quelle, und ohne " +
        "Grundlage eine benannte Lücke.",
    ).toEqual([]);
  });
});
