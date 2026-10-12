// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0205 — DIE OFFICE-BELEGSTELLENLISTE
// KENNZEICHNET UNGEPRÜFTE QUELLEN.
// ================================================================================================
//
// Bens Befund (Nacharbeit 29): `OfficeImArtikel.tsx` (Liste „Belegstellen") zeigte jede Quelle nur
// mit Bezeichnung und Dokumentstand — ohne „Stufe 2" und „Extern · ungeprüft". Jetzt trägt jede
// Belegstelle die gemeinsame `ExterneQuelleKennung`, gespeist aus `peerValidated` der Lage.
//
// GEMESSEN an der echten Komponente: der Anhang wird über seinen Knopf aufgeklappt; ersetzt ist
// ausschliesslich der Abruf `officeArtikel.lage` (Netz). Drei Belegstellen, je Prüfstand eine:
//   · `false`, aktueller Dokumentstand            → beide Etiketten
//   · ohne Feld (ältere Antwort), früherer Stand  → beide Etiketten (fail-closed)
//   · `true`, aktueller Dokumentstand             → keine (Gegenprobe)
// Der Dokumentstand („aktuell"/„früher") steht unverändert daneben. DE und EN.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { type OfficeAnhangLage, officeArtikel } from "../../apps/web/src/api/officeArtikel";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { OfficeImArtikel } from "../../apps/web/src/components/bibliothek/OfficeImArtikel";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LAGE: OfficeAnhangLage = {
  anwendung: "word",
  endung: "docx",
  bearbeitbar: true,
  schreibweg: "nur-lesen",
  editorEingerichtet: false,
  fassung: 2,
  status: "validiert",
  verlauf: [
    { version: 1, at: "2026-10-01T08:00:00Z", author: "anna", objectId: "obj-a", aktuell: false },
    { version: 2, at: "2026-10-02T08:00:00Z", author: "anna", objectId: "obj-b", aktuell: true },
  ],
  belegstellen: [
    {
      quelleId: "q-extern",
      label: "Herstellerblatt Pumpe",
      excerpt: null,
      stand: "aktuell",
      peerValidated: false,
    },
    {
      quelleId: "q-alt",
      label: "Altes Handbuch Pumpe",
      excerpt: null,
      stand: "frueher",
      ausFassung: 1,
    },
    {
      quelleId: "q-geprueft",
      label: "Betriebsanweisung Pumpe",
      excerpt: null,
      stand: "aktuell",
      peerValidated: true,
    },
  ],
  sitzung: { laeuft: false },
  gesichert: [],
};

const KO = {
  id: "ko-office",
  title: "Pumpe anfahren",
  attachments: [{ id: "anh-1", name: "Plan.docx", mime: "x", objectId: "obj-b" }],
  sources: [],
} as unknown as KnowledgeObject;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  await i18n.changeLanguage("de");
});

async function aufklappen(): Promise<void> {
  vi.spyOn(officeArtikel, "lage").mockResolvedValue(LAGE);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(OfficeImArtikel, { ko: KO }),
      ),
    );
  });
  const knopf = container.querySelector<HTMLButtonElement>('[data-office-oeffnen="anh-1"]');
  expect(knopf, "der Anhang lässt sich nicht aufklappen").not.toBeNull();
  await act(async () => {
    knopf?.click();
  });
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

function belegstelle(label: string): HTMLElement {
  const alle = [...container.querySelectorAll<HTMLElement>("[data-office-beleg]")];
  const treffer = alle.filter((li) => (li.textContent ?? "").includes(label));
  expect(treffer, `die Belegstelle „${label}" steht nicht genau einmal da`).toHaveLength(1);
  return treffer[0] as HTMLElement;
}

describe("R-0205 · Office-Belegstellen tragen „Stufe 2“ und „Extern · ungeprüft“", () => {
  for (const sprache of ["de", "en"] as const) {
    it(`${sprache}: ungeprüft und ohne Prüfstand gekennzeichnet, peer-validiert nicht`, async () => {
      await i18n.changeLanguage(sprache);
      await aufklappen();
      const stufe = i18n.t("externequelle.stufe");
      const herkunft = i18n.t("ko.sourceExternUnchecked");

      for (const label of ["Herstellerblatt Pumpe", "Altes Handbuch Pumpe"]) {
        const text = belegstelle(label).textContent ?? "";
        expect(text, `${sprache}: „${label}" ohne „${stufe}"`).toContain(stufe);
        expect(text, `${sprache}: „${label}" ohne „${herkunft}"`).toContain(herkunft);
      }
      const geprueft = belegstelle("Betriebsanweisung Pumpe").textContent ?? "";
      expect(geprueft).not.toContain(stufe);
      expect(geprueft).not.toContain(herkunft);

      // Der Dokumentstand steht unverändert und unabhängig vom Prüfstand daneben.
      expect(belegstelle("Herstellerblatt Pumpe").dataset.officeBeleg).toBe("aktuell");
      expect(belegstelle("Altes Handbuch Pumpe").dataset.officeBeleg).toBe("frueher");
      expect(belegstelle("Altes Handbuch Pumpe").textContent).toContain(
        i18n.t("officeartikel.belegFrueher", { fassung: 1 }),
      );
    });
  }
});
