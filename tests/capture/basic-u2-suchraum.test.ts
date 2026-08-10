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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const SPRACHEN = ["de", "en", "nl"] as const;

// Neu angelegt in diesem Schnitt.
const NEUE_SCHLUESSEL = [
  "lib.scope.note",
  "lib.scope.toDrafts",
  "capture.draftScope.note",
  "capture.draftScope.noteAdmin",
  "capture.draftScope.toLibrary",
] as const;

// Vorhanden, aber umgeschrieben: sie nannten den Suchraum nicht.
const GEAENDERTE_SCHLUESSEL = [
  "lib.empty",
  "lib.emptyQuery",
  "capture.draftEmptyFiltered",
] as const;

function wert(locale: string, key: string): string {
  return String(i18n.getResource(locale, "translation", key));
}

const WEB_SRC = join(__dirname, "../../apps/web/src");
const librarySrc = readFileSync(join(WEB_SRC, "pages", "Library.tsx"), "utf8");
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
    for (const locale of SPRACHEN) {
      expect(wert(locale, "lib.emptyQuery")).toContain("{{q}}");
    }
    // Die neuen Sätze tragen keine Variable — eine offene Klammer wäre hier ein Fehler.
    for (const key of NEUE_SCHLUESSEL) {
      for (const locale of SPRACHEN) {
        expect(wert(locale, key)).not.toContain("{{");
      }
    }
  });

  it("echte Umlaute, keine Umschrift (DE)", () => {
    expect(wert("de", "lib.scope.toDrafts")).toContain("ü");
    expect(wert("de", "capture.draftScope.note")).toContain("ü");
  });
});

describe("BASIC-u2 · AK1 — der Bibliothekstext benennt den durchsuchten Bestand", () => {
  it("die Angabe nennt das zugängliche Klarwerk-Wissen und grenzt die Entwürfe ab", () => {
    const note = wert("de", "lib.scope.note");
    expect(note).toMatch(/Klarwerk-Wissen/);
    expect(note).toMatch(/freigegeben/);
    expect(note).toMatch(/Entw(u|ü)rfe/);
  });

  it("der Gegenweg trägt einen Namen, der sagt, wohin er führt", () => {
    expect(wert("de", "lib.scope.toDrafts")).toMatch(/Entw(u|ü)rfe/);
    expect(wert("en", "lib.scope.toDrafts")).toMatch(/drafts/i);
    expect(wert("nl", "lib.scope.toDrafts")).toMatch(/concepten/i);
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
  it("die Bibliothek nennt im Nulltreffer den Suchraum UND die andere Suchwelt", () => {
    for (const key of ["lib.empty", "lib.emptyQuery"] as const) {
      const v = wert("de", key);
      expect(v, `${key} nennt den Suchraum nicht`).toMatch(/Klarwerk-Wissen/);
      expect(v, `${key} nennt die andere Suchwelt nicht`).toMatch(/Entw(u|ü)rfe/);
      // Der Satz, der den Befund ausgelöst hat, darf nicht zurückkehren.
      expect(v).not.toBe("Keine Treffer.");
    }
    expect(wert("en", "lib.empty")).toMatch(/drafts/i);
    expect(wert("nl", "lib.empty")).toMatch(/concepten/i);
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
  it("Bibliothek: der neue Block spricht nur über t()", () => {
    const anfang = librarySrc.indexOf("AUFTRAG-BASIC-u2");
    const ende = librarySrc.indexOf('isDemoContext(params) ? <DemoBanner surface="library"');
    expect(anfang, "der neue Suchraum-Block fehlt").toBeGreaterThan(-1);
    expect(ende, "der Block steht nicht vor dem Demo-Banner").toBeGreaterThan(anfang);
    const block = librarySrc.slice(anfang, ende);
    expect(block).toContain('t("lib.scope.note")');
    expect(block).toContain('t("lib.scope.toDrafts")');
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

  it("der Leerzustand hängt weiter an derselben Verzweigung", () => {
    expect(librarySrc).toContain(
      'emptyText={trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")}',
    );
  });

  it("der Gegenweg der Bibliothek läuft über das Rollentor, nicht über einen rohen Link", () => {
    // `/erfassen` verlangt die Rolle „experte" — ein roher <Link> wäre für eine Betrachterin ein
    // Weg in den stillen Rückwurf (die Bauform hält mega70 Block D fest).
    expect(librarySrc).toContain('<RoleLink\n          to="/erfassen"');
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
