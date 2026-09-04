// ================================================================================================
// AUFTRAG-BASIC-u2 — DIE SPRACH- UND QUELLTEXTSEITE DES SCHNITTS.
// ================================================================================================
// Die beiden gemounteten Dateien (basic-u2-suchraum-bibliothek.test.tsx und
// basic-u2-suchraum-entwuerfe.test.tsx) beweisen, dass die Suchraum-Angabe und der Gegenweg
// wirklich auf den Seiten stehen und bedienbar sind. HIER stehen die drei Fragen, die keine
// gemountete Seite braucht — und die deshalb Node-rein bleiben, also im Root-Typecheck mitlaufen:
//
//  · AK5 SPRACHE: DE, EN und NL tragen jeden neuen und jeden geänderten Schlüssel, mit erhaltenen
//    Platzhaltern und ohne stille DE-Kopie.
//  · AK1/2/4 WORTLAUT: die Texte nennen den Suchraum wirklich und behaupten im Nulltreffer NICHT,
//    es gebe nichts. Ein Test, der nur „irgendein Text ist da" prüft, ginge auch bei „Keine
//    Treffer." durch — genau dem Satz, der den Befund ausgelöst hat.
//  · AK5/AK7 QUELLTEXT: der neue JSX-Block trägt keine hartkodierte sichtbare Zeichenkette, und
//    Query, Ranking und Trefferberechnung stehen unverändert dort, wo sie standen.
//
// BENANNTE BLINDHEIT: Quelltext ist kein Verhalten. Dass der Suchraum-Satz auch WAHR ist (die
// Bibliothek zeigt wirklich nur Zugängliches, die Entwurfsliste wirklich nur Entwürfe), entscheiden
// Backend und Bestandslogik — beide sind in diesem Schnitt unangetastet und hier nicht Gegenstand.
//
// ==================================================================================================
// JOB 3063 (H4) — WAS AUF DER BIBLIOTHEKSSEITE DIESES SCHNITTS ABGELÖST WURDE, UND VON WEM.
// ==================================================================================================
//
// Der Eigentümer hat am 04.09.2026 (07:50/07:58) über die Bibliothek entschieden: Maßstab Apple
// Pages, „Text über Text über Text" verschwindet aus dem Sichtfeld, Erklärendes lebt hinter Menüs.
// AUFTRAG 3063 §8.5 sagt dazu ausdrücklich: „Codex prüft gegen DIESE Vorgabe, nicht gegen alte Pins."
//
// DAMIT SIND ZWEI ZUSAGEN DIESES SCHNITTS AUF DER BIBLIOTHEKSSEITE GESTRICHEN — nicht stillschweigend,
// sondern hier benannt:
//   · `lib.scope.note` („Durchsucht wird das Klarwerk-Wissen, das für dich freigegeben ist …") ist
//     als Schlüssel und als Satz ENTFERNT. Er stand dauerhaft unter dem Suchfeld; der Textmesser
//     `tests/design/zielbild-h4-kein-erklaertext.test.ts` (Fall T4) macht seine Rückkehr rot.
//   · `lib.scope.toDrafts` ist als eigener Dauer-Gegenweg entfernt. Der Weg SELBST bleibt — als
//     Knopf „Erfassen" (`lib.liste.erfassen`) in der leeren Liste, über dasselbe Rollentor
//     (`components/bibliothek/BibliothekFlaeche.tsx:470-482`). Dass er dort wirklich steht und zur
//     richtigen Adresse führt, misst `basic-u2-suchraum-bibliothek.test.tsx` an der gemounteten
//     Fläche und `tests/design/h4-funktionsinventar.test.ts` (F18) in Chromium.
//
// WAS UNVERÄNDERT GILT und hier weiter geprüft wird: die ENTWURFSSEITE des Schnitts (Erfassen) ist
// von JOB 3063 nicht berührt; und die Nulltreffer-Zusage der Bibliothek bleibt in ihrem KERN — kein
// Satz behauptet, im System gebe es nichts. Er lautet jetzt nur kürzer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const SPRACHEN = ["de", "en", "nl"] as const;

// Neu angelegt in diesem Schnitt (die Bibliotheksschlüssel sind mit JOB 3063 entfallen, s. o.).
const NEUE_SCHLUESSEL = [
  "capture.draftScope.note",
  "capture.draftScope.noteAdmin",
  "capture.draftScope.toLibrary",
] as const;

// Vorhanden, aber umgeschrieben: sie nannten den Suchraum nicht.
// JOB 3063: `lib.empty`/`lib.emptyQuery` sind durch die zwei Sätze der neuen Liste ersetzt
// (`lib.liste.leer` „Noch keine Einträge.", `lib.liste.leerSuche` „Nichts gefunden.") plus den Knopf
// `lib.liste.erfassen`. Die Sprachprüfung zieht mit — sie hängt an der Zusage, nicht am alten Namen.
const GEAENDERTE_SCHLUESSEL = [
  "lib.liste.leer",
  "lib.liste.leerSuche",
  "lib.liste.erfassen",
  "capture.draftEmptyFiltered",
] as const;

/** Die Schlüssel, die dieser Schnitt für die Bibliothek angelegt hatte und die JOB 3063 zurücknimmt. */
const ABGELOESTE_SCHLUESSEL = [
  "lib.scope.note",
  "lib.scope.toDrafts",
  "lib.empty",
  "lib.emptyQuery",
] as const;

function wert(locale: string, key: string): string {
  return String(i18n.getResource(locale, "translation", key));
}

const WEB_SRC = join(__dirname, "../../apps/web/src");
// JOB 3063: `pages/Library.tsx` ist nur noch die Route. Der Suchweg, der Leerzustand und der
// Gegenweg liegen in der Fläche — dort wird jetzt gepinnt.
const librarySrc = readFileSync(
  join(WEB_SRC, "components", "bibliothek", "BibliothekFlaeche.tsx"),
  "utf8",
);
const captureSrc = readFileSync(join(WEB_SRC, "pages", "Capture.tsx"), "utf8");

// Jeder JSX-Ausdruck (auch `{/* Kommentare */}` und geschachtelte Bedingungen) fällt heraus; übrig
// bleibt genau das, was OHNE t() im Markup stünde. Buchstaben darin wären eine hartkodierte
// sichtbare Zeichenkette — Pfeile, Klammern und Leerraum sind keine.
function sichtbarerText(block: string): string[] {
  let ohneAusdruecke = "";
  let tiefe = 0;
  for (const ch of block) {
    if (ch === "{") {
      tiefe += 1;
    } else if (ch === "}") {
      tiefe = Math.max(0, tiefe - 1);
    } else if (tiefe === 0) {
      ohneAusdruecke += ch;
    }
  }
  return [...ohneAusdruecke.matchAll(/>([^<>]*)</g)]
    .map((m) => (m[1] ?? "").trim())
    .filter((s) => /[A-Za-zÄÖÜäöüß]/.test(s));
}

describe("BASIC-u2 · AK5 — DE, EN und NL sind vollständig", () => {
  for (const key of [...NEUE_SCHLUESSEL, ...GEAENDERTE_SCHLUESSEL]) {
    for (const locale of SPRACHEN) {
      it(`${locale} · ${key} ist vorhanden und übersetzt`, () => {
        const v = wert(locale, key);
        expect(v, `${locale}/${key} fehlt`).toBeTruthy();
        expect(v, `${locale}/${key} ist nicht übersetzt`).not.toBe("undefined");
        expect(v, `${locale}/${key} ist ein durchgereichter Rohschlüssel`).not.toBe(key);
      });
    }
  }

  it("keine stille DE-Kopie in EN oder NL", () => {
    for (const key of [...NEUE_SCHLUESSEL, ...GEAENDERTE_SCHLUESSEL]) {
      expect(wert("en", key), `en/${key} ist die DE-Zeile`).not.toBe(wert("de", key));
      expect(wert("nl", key), `nl/${key} ist die DE-Zeile`).not.toBe(wert("de", key));
    }
  });

  it("die Platzhalter bleiben je Schlüssel erhalten (sonst bricht die Interpolation)", () => {
    // Der Zähler im Listenfuß ist die Stelle, an der die Bibliothek noch interpoliert.
    for (const locale of SPRACHEN) {
      expect(wert(locale, "lib.liste.eintraege_other")).toContain("{{count}}");
    }
    // Die neuen Sätze tragen keine Variable — eine offene Klammer wäre hier ein Fehler.
    for (const key of [...NEUE_SCHLUESSEL, "lib.liste.leer", "lib.liste.leerSuche"]) {
      for (const locale of SPRACHEN) {
        expect(wert(locale, key)).not.toContain("{{");
      }
    }
  });

  it("echte Umlaute, keine Umschrift (DE)", () => {
    expect(wert("de", "lib.liste.leer")).toContain("ä");
    expect(wert("de", "capture.draftScope.note")).toContain("ü");
  });
});

describe("BASIC-u2 · AK1 — abgelöst durch die Eigentümerentscheidung vom 04.09.2026", () => {
  // Der Dauersatz über dem Suchfeld ist gestrichen (Kopf dieser Datei). Statt den Fall zu löschen,
  // hält er die Ablösung AUSFÜHRBAR fest: die Schlüssel sind wirklich weg — in allen drei Sprachen.
  // Eine spätere Wiedereinführung „nebenbei" wird hier rot, und zwar mit Begründung.
  it("die vier abgelösten Bibliotheksschlüssel stehen in KEINER Sprache mehr in i18n.ts", () => {
    for (const key of ABGELOESTE_SCHLUESSEL) {
      for (const locale of SPRACHEN) {
        expect(
          i18n.getResource(locale, "translation", key),
          `${locale}/${key} ist zurückgekehrt — H4 hat ihn abgelöst`,
        ).toBeUndefined();
      }
    }
  });

  it("der Gegenweg trägt weiter einen Namen, der sagt, wohin er führt", () => {
    // Nicht mehr „Zu meinen Entwürfen" als Dauerzeile, sondern der Knopf in der leeren Liste.
    expect(wert("de", "lib.liste.erfassen")).toBe("Erfassen");
    expect(wert("en", "lib.liste.erfassen")).toBe("Capture");
    expect(wert("nl", "lib.liste.erfassen")).toBe("Vastleggen");
  });
});

describe("BASIC-u2 · AK2 — der Entwurfstext benennt den durchsuchten Bestand", () => {
  it("die Angabe nennt die eigenen gespeicherten Entwürfe und grenzt die Bibliothek ab", () => {
    const note = wert("de", "capture.draftScope.note");
    expect(note).toMatch(/Entw(u|ü)rfe/);
    expect(note).toMatch(/Bibliothek/);
  });

  it("die Admin-Ansicht bekommt einen eigenen, wahren Satz (sie sieht ALLE Entwürfe)", () => {
    for (const locale of SPRACHEN) {
      expect(wert(locale, "capture.draftScope.noteAdmin")).not.toBe(
        wert(locale, "capture.draftScope.note"),
      );
    }
    expect(wert("de", "capture.draftScope.noteAdmin")).toMatch(/Admin/);
  });

  it("der Gegenweg trägt einen Namen, der sagt, wohin er führt", () => {
    expect(wert("de", "capture.draftScope.toLibrary")).toMatch(/Klarwerk-Wissen/);
    expect(wert("en", "capture.draftScope.toLibrary")).toMatch(/Klarwerk knowledge/);
    expect(wert("nl", "capture.draftScope.toLibrary")).toMatch(/Klarwerk-kennis/);
  });
});

describe("BASIC-u2 · AK4 — kein Nulltreffer behauptet, im System sei nichts", () => {
  it("die Bibliothek sagt im Nulltreffer, was sie WEISS — und behauptet nichts über das System", () => {
    // Der KERN der Zusage bleibt: der Satz spricht über den Suchvorgang („Nichts gefunden."), nicht
    // über den Bestand des Systems. „Keine Treffer." war genau die Verwechslung, die den Befund
    // ausgelöst hat; sie darf in keiner Sprache zurückkehren.
    for (const key of ["lib.liste.leer", "lib.liste.leerSuche"] as const) {
      for (const locale of SPRACHEN) {
        const v = wert(locale, key);
        expect(v, `${locale}/${key} fehlt`).toBeTruthy();
        expect(v).not.toBe("Keine Treffer.");
      }
    }
    // Und die zwei Fälle bleiben UNTERSCHIEDEN: „mit Suchtext, nichts gefunden" ist nicht dasselbe
    // wie „der Bestand ist leer". Ein gemeinsamer Satz wäre der Rückfall in die alte Unschärfe.
    for (const locale of SPRACHEN) {
      expect(wert(locale, "lib.liste.leerSuche")).not.toBe(wert(locale, "lib.liste.leer"));
    }
  });

  it("die Entwurfssuche nennt im Nulltreffer den Suchraum UND die andere Suchwelt", () => {
    const v = wert("de", "capture.draftEmptyFiltered");
    expect(v).toMatch(/Entw(u|ü)rfe/);
    expect(v).toMatch(/Bibliothek/);
    expect(v).not.toBe("Keine Entwürfe passen zum Filter.");
    expect(wert("en", "capture.draftEmptyFiltered")).toMatch(/library/i);
    expect(wert("nl", "capture.draftEmptyFiltered")).toMatch(/bibliotheek/i);
  });
});

describe("BASIC-u2 · AK5 — kein hartkodierter sichtbarer Text im neuen JSX", () => {
  it("Bibliothek: der Gegenweg-Block spricht nur über t()", () => {
    // JOB 3063: an die Stelle des Suchraum-Blocks tritt der Knopf in der leeren Liste. Die Zusage
    // („kein Text am t() vorbei") gilt unverändert — nur am neuen Ort.
    const anfang = librarySrc.indexOf("leerAktion={");
    const ende = librarySrc.indexOf("menues={", anfang);
    expect(anfang, "der Leerzustands-Gegenweg fehlt").toBeGreaterThan(-1);
    expect(ende, "der Block steht nicht vor den Menüs").toBeGreaterThan(anfang);
    const block = librarySrc.slice(anfang, ende);
    expect(block).toContain('t("lib.liste.erfassen")');
    expect(sichtbarerText(block)).toEqual([]);
  });

  it("Erfassen: der neue Block spricht nur über t()", () => {
    const anfang = captureSrc.indexOf("AUFTRAG-BASIC-u2");
    const ende = captureSrc.indexOf("<CaptureDraftList");
    expect(anfang, "der neue Suchraum-Block fehlt").toBeGreaterThan(-1);
    expect(ende, "der Block steht nicht vor der Entwurfsliste").toBeGreaterThan(anfang);
    const block = captureSrc.slice(anfang, ende);
    expect(block).toContain('t("capture.draftScope.note")');
    expect(block).toContain('t("capture.draftScope.noteAdmin")');
    expect(block).toContain('t("capture.draftScope.toLibrary")');
    expect(sichtbarerText(block)).toEqual([]);
  });
});

describe("BASIC-u2 · AK7 — Query, Filterung, Ranking und Sichtbarkeit sind unverändert", () => {
  it("der Serverpfad der Bibliothekssuche steht unverändert im Quelltext", () => {
    expect(librarySrc).toContain(
      "const query = useLibrarySearch(buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: debouncedQ }));",
    );
    expect(librarySrc).toContain("const ranked = searchLibrary(koItems, trimmedQ);");
  });

  it("der Leerzustand hängt weiter an derselben Verzweigung: mit Suchtext anders als ohne", () => {
    // Die Verzweigung ist mit der Liste umgezogen; sie ist dieselbe geblieben.
    const listeSrc = readFileSync(
      join(WEB_SRC, "components", "bibliothek", "BibliothekListe.tsx"),
      "utf8",
    );
    expect(listeSrc).toContain('q.trim() ? t("lib.liste.leerSuche") : t("lib.liste.leer")');
  });

  it("der Gegenweg der Bibliothek läuft über das Rollentor, nicht über einen rohen Link", () => {
    // `/erfassen` verlangt die Rolle „experte" — ein roher <Link> wäre für eine Betrachterin ein
    // Weg in den stillen Rückwurf (die Bauform hält mega70 Block D fest).
    const anfang = librarySrc.indexOf("leerAktion={");
    const block = librarySrc.slice(anfang, librarySrc.indexOf("menues={", anfang));
    expect(block).toContain("<RoleLink");
    expect(block).toContain('to={ownEmpty ? ownEmpty.to : "/erfassen"}');
  });

  it("die Erfassungsseite reicht die Entwurfsliste unverändert an dasselbe Bauteil durch", () => {
    expect(captureSrc).toContain("<CaptureDraftList\n          drafts={drafts.data ?? []}");
    expect(captureSrc).toContain("onToggleOpen={() => setDraftsOpen((open) => !open)}");
  });

  it("die Filterlogik der Entwurfsliste ist nicht Teil dieses Schnitts", () => {
    const listView = readFileSync(join(WEB_SRC, "lib", "draftListView.ts"), "utf8");
    // Die eine Stelle, die filtert, steht unverändert dort — nicht in der Seite.
    expect(listView).toContain("draftSearchText(draft, titleFallback).includes(query)");
    expect(captureSrc).not.toContain("draftSearchText");
  });
});
