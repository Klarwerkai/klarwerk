// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-bildbudget · R-0021 — DIE TEXTBEDINGTE GRÖSSENGRENZE AM GEMOUNTETEN PANEL
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 3): Der Dokument-Weg lehnt seit Nacharbeit 2 auch einen Entwurf ab, dessen
// TEXT serialisiert zu groß ist (`DOCX_BILDGRENZE`, `grenze: "rumpf"` — Fall D1 in
// dokumentgrenze.test.ts: drei Millionen Backslashes). Das Panel zeigt jede 413 als `sendTooLarge`,
// und dieser Satz empfahl nur weniger oder kleinere Bilder — dort hilft das Entfernen des Bildes
// nicht. Der Satz nennt jetzt auch Kürzen und Aufteilen.
//
// WIE GEMESSEN WIRD: dasselbe ausgelieferte Fenster wie tests/addin-bildbilanz (`createKlaraPanel`),
// der echte `.docx`-Weg (`getFileAsync` → `sendeDocxDatei` → `POST /api/drafts/from-docx`), und als
// Antwort genau die Form, die `pruefeDocxBildgrenzen` für den Rumpffall erzeugt. Die erwarteten
// Sätze stehen WÖRTLICH hier und nicht als `p.t(…)` — sonst prüfte das Wörterbuch sich selbst.
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

let panel: KlaraPanel | null = null;

afterEach(() => {
  panel?.restore();
  panel = null;
});

/** Die 413-Antwort des Servers im Rumpffall — Werte aus D1, nicht erfunden in der Form. */
const RUMPF_ABGELEHNT = {
  error: "DOCX_BILDGRENZE",
  grenze: "rumpf",
  message:
    "Der Entwurf aus diesem Dokument waere beim Speichern und Einreichen zu gross (5.8 MiB mit Kodierung, erlaubt sind 4.8 MiB). Es wurde kein Entwurf angelegt und kein Bild weggelassen. Bitte mit weniger Text, weniger oder kleineren Bildern oder in Teilen erneut senden.",
  draftCreated: false,
  imageTransfer: "not_completed",
  imagesTotal: 1,
  maxImages: 60,
  bodyBytes: 3_100_000,
  maxBodyBytes: 3_500_000,
  requestBytes: 6_100_000,
  maxRequestBytes: 4_980_736,
};

const ERWARTET = {
  de: "Zu groß für die Übertragung — es wurde KEIN Entwurf angelegt; erneut senden, sobald das Dokument gekürzt ist, in Teilen gesendet wird oder weniger (höchstens 60) oder kleinere Bilder hat.",
  en: "Too large to transfer — NO draft was created; send again once the document is shortened, sent in parts, or has fewer (at most 60) or smaller images.",
  nl: "Te groot voor de overdracht — er is GEEN concept aangemaakt; opnieuw verzenden zodra het document is ingekort, in delen wordt verzonden of minder (hoogstens 60) of kleinere afbeeldingen heeft.",
} as const;

async function sendeAbgelehnt(sprache: keyof typeof ERWARTET): Promise<KlaraPanel> {
  const p = createKlaraPanel({
    docxDatei: { bytes: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00], scheibenBytes: 4 },
    routes: { "/api/drafts/from-docx": reply(413, RUMPF_ABGELEHNT) },
  });
  panel = p;
  await p.flush();
  p.setLang(sprache);
  p.sendDocument();
  await p.flush();
  expect(
    p.calls.filter((c) => c.url === "/api/drafts/from-docx"),
    "der Lauf ist NICHT über den .docx-Weg gegangen",
  ).toHaveLength(1);
  return p;
}

describe("R-0021 · die textbedingte Ablehnung des Dokument-Wegs am gemounteten Panel", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`R1 · ${sprache}: EIN Satz, nichts angelegt, die Abhilfe nennt Kürzen und Aufteilen`, async () => {
      const p = await sendeAbgelehnt(sprache);
      const satz = p.text("#send-status");
      expect(satz).toBe(ERWARTET[sprache]);
      // Dieselbe Satzzählung wie tests/design/zielbild-k2-kein-erklaertext.test.ts.
      expect((satz.match(/[.!?…](?=\s|$)/g) ?? []).length).toBe(1);
      // Kein Entwurf, keine Bildaussage — nur der Fehlersatz, und keine Schlüsselkennung.
      expect(p.text("#capture-bilder-satz")).toBe("");
      expect(satz).not.toMatch(/sendTooLarge/);
    });
  }

  it("R2 · die drei Sprachen sagen nicht dasselbe — keine durchgereichte Schlüsselkennung", async () => {
    const saetze: string[] = [];
    for (const sprache of ["de", "en", "nl"] as const) {
      const p = await sendeAbgelehnt(sprache);
      saetze.push(p.text("#send-status"));
      p.restore();
      panel = null;
    }
    expect(new Set(saetze).size).toBe(3);
  });
});
