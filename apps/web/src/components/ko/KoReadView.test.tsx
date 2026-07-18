import { afterEach, describe, expect, it } from "vitest";
import { makeKo, makeSource, renderMarkup, setLanguage } from "../../test/render";
import { KoReadView } from "./KoReadView";

// SCRUM-513 (WP3): der VIP-Sichtvertrag der KO-Leseansicht. Pinnt, dass WAS gilt · WIE sicher · WOHER ·
// WER/WANN gleichzeitig sichtbar sind (Zonen 1–3), die Belegzeile eine KLICKBARE Quelle trägt, die
// Konfidenz als lesbare %-Sprache erscheint, sekundäre Felder eingeklappt sind und i18n greift.

afterEach(async () => {
  await setLanguage("de");
});

function fullKo() {
  return makeKo({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    confidence: 84,
    category: "Anlage 1",
    author: "anna",
    version: 3,
    conditions: ["Bei Überdruck"],
    measures: ["Ventil schließen"],
    tags: ["druck"],
    sources: [makeSource({ url: "https://ex.com/handbuch", at: "2026-04-20T10:00:00.000Z" })],
  });
}

describe("KoReadView — VIP-Sichtvertrag", () => {
  it("Zone 1: Kernaussage + Konfidenz als lesbare %-Sprache", () => {
    const html = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(html).toContain("Ventil bei Überdruck schließen"); // WAS gilt (Titel)
    expect(html).toContain("Bei Überdruck Ventil X manuell schließen."); // Aussage
    expect(html).toContain("84 % sicher"); // WIE sicher (nicht nur Rohzahl)
  });

  it("Zone 2: Beleg sichtbar mit KLICKBARER Quelle + Quelldatum + Freigabe", () => {
    const html = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(html).toContain("Beleg"); // Zonen-Label
    expect(html).toContain('href="https://ex.com/handbuch"'); // WOHER: klickbare Quelle
    expect(html).toContain("2026"); // Quelldatum
    expect(html).toContain("Freigabe"); // WER/WANN-Rahmen
  });

  it("Zone 3: Kategorie · Verantwortlich · Version kompakt sichtbar", () => {
    const html = renderMarkup(<KoReadView ko={fullKo()} responsibleName="Anna Muster" />);
    expect(html).toContain("Kategorie");
    expect(html).toContain("Anlage 1");
    expect(html).toContain("Verantwortlich");
    expect(html).toContain("Anna Muster"); // aufgelöster Name statt Roh-ID
    expect(html).toContain("v3");
  });

  it("sekundäre Felder liegen in einem aufklappbaren <details> (nicht im Hero)", () => {
    const html = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(html).toContain("<details");
    expect(html).toContain("Weitere Angaben");
    // Der Detailinhalt (Bedingungen/Maßnahmen) steckt im Disclosure.
    expect(html).toContain("Bei Überdruck");
    expect(html).toContain("Ventil schließen");
  });

  it("nachgeordnete Aktionen: der actions-Slot wird nach den Zonen gerendert", () => {
    const html = renderMarkup(
      <KoReadView ko={fullKo()} actions={<button type="button">MEINE-AKTION</button>} />,
    );
    const zoneIdx = html.indexOf("Beleg");
    const actionIdx = html.indexOf("MEINE-AKTION");
    expect(actionIdx).toBeGreaterThan(zoneIdx); // Aktionen kommen NACH dem Beleg
  });

  it("ehrlicher Leerzustand: KO ohne Quelle zeigt keine Quelle statt Fake", () => {
    const html = renderMarkup(<KoReadView ko={makeKo({ sources: [] })} />);
    expect(html).toContain("keine Quelle hinterlegt");
  });

  it("G-2-EHRLICHKEIT: KO ohne Quelle labelt createdAt NICHT als Quell-/Freigabedatum", () => {
    const createdAt = "2026-05-01T12:00:00.000Z";
    const html = renderMarkup(<KoReadView ko={makeKo({ sources: [], createdAt })} />);
    // Ohne echte Quelle: ehrliches „kein Quelldatum" statt „Quelle vom <createdAt>".
    expect(html).toContain("kein Quelldatum");
    expect(html).not.toContain("Quelle vom");
    // createdAt erscheint ehrlich als Erfassungsdatum …
    expect(html).toContain("Erfasst am");
    // … und GENAU EINMAL: nicht zusätzlich als Freigabedatum in der Freigabe-Zeile.
    const dateText = new Date(createdAt).toLocaleDateString("de");
    expect(html.split(dateText).length - 1).toBe(1);
  });

  it("responsive Zone 3 nutzt flex-wrap (schmal umbruchfähig)", () => {
    const html = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(html).toContain("flex-wrap");
  });

  it("i18n: Zonen-Labels folgen der Sprache (DE → EN → NL)", async () => {
    const de = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(de).toContain("Beleg");
    expect(de).toContain("Freigabe");
    await setLanguage("en");
    const en = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(en).toContain("Evidence");
    expect(en).toContain("Release");
    expect(en).toContain("84 % confident");
    expect(en).not.toContain("Beleg");
    await setLanguage("nl");
    const nl = renderMarkup(<KoReadView ko={fullKo()} />);
    expect(nl).toContain("Bewijs");
    expect(nl).toContain("84 % zeker");
  });
});
