// @vitest-environment jsdom
// ================================================================================================
// JOB 3254 · M5c-UI (RUNDE 2) — DIE LETZTE MEILE: DER EDITOR ZEIGT SIE WIRKLICH.
// ================================================================================================
//
// DER BEFUND, DER RUNDE 1 ROT GEMACHT HAT (Codex 26e02b99): die Mehrdeutigkeitsmarke am Einzelbild
// erreichte den Editor NICHT. Sie stand als Attribut im importierten Rumpf, und der reale Weg
// /erfassen führt genau durch die beiden Sanitizer, die jedes figcaption-Attribut ausser
// `data-image-id` entfernen — beim Sichern (Server) und beim Laden (Editor).
//
// DIESE DATEI IST DER GEGENBEWEIS FÜR RUNDE 2, und sie misst am GEMOUNTETEN Editor, nicht am
// Baustein: der Rumpf, den sie in `RichTextEditor` gibt, ist der SANITISIERTE Rumpf, wie ihn ein
// gespeicherter Entwurf zurückgibt. Sähe ein Mensch die Kennzeichnung nicht, wäre dieser Test rot.
//
// WARUM DER EDITOR UND NICHT DIE ERFASSEN-SEITE: die Fläche, die das importierte Dokument ZEIGT,
// ist der Editor — auf der Erfassen-Seite (Arbeitsraum) wird die Datei gelesen und gesichert, im
// Blatt wird sie danach angezeigt. Beide Flächen reichen ihren Rumpf an DIESE eine Komponente, und
// sie liest die Kennungen selbst (`mehrdeutigeFussnotenJetzt`). Damit gilt der Nachweis für jede
// Einbindung, ohne dass eine von ihnen etwas durchreichen muss.
//
// DIE GRENZE, die dieser Test ausdrücklich mitmisst (S3): die Auskunft lebt im Speicher DIESES
// Seitenlebens. Wird sie geräumt — genau das tut ein neuer Lesevorgang, und genau das täte ein
// Neuladen der Seite —, ist die Kennzeichnung fort. Sie darf nicht gespeichert werden (§10); der
// dauerhafte Beleg des Imports ist die Beschriftungsbilanz der Quittung.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import {
  CAPTION_AMBIGUOUS_ATTR,
  merkeMehrdeutigeFussnoten,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";
// Die EINE Naht für isoliert gemountete Editor-Tests (mega50 Block A) — nicht eine zweite bauen.
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";
import {
  type Absatz,
  PNG_BLAU,
  PNG_ROT,
  alsPuffer,
  baueDocx,
} from "../m5-docx-bildunterschriften/docx-bauen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** (a) ein Bild ganz ohne Anwärter, (b) zwei Bilder um eine Legende — der Unterschied im Dokument. */
const DOKUMENT_A_UND_B: Absatz[] = [
  { art: "bild", png: PNG_ROT, alt: "ohne-anwaerter.png" },
  { art: "text", text: "Dieser Absatz ist keine Beschriftung, sondern ein Satz." },
  { art: "bild", png: PNG_BLAU, alt: "detail-a.png" },
  { art: "beschriftung", text: "Abbildung 1: Offen" },
  { art: "bild", png: PNG_ROT, alt: "detail-b.png" },
];

/**
 * Der Rumpf, wie ihn der Editor im Betrieb vorfindet: importiert, über den Server gesichert
 * (Server-Sanitizer) und wieder geladen. Dazu die Kennungen, die `Capture.tsx` beim Einlesen
 * ablegt — dieselben Werte, aus derselben Quelle.
 */
async function importiertUndGesichert(): Promise<{ html: string; ids: readonly string[] }> {
  const { bytes } = await baueDocx(DOKUMENT_A_UND_B);
  const reich = await extractDocxRich(alsPuffer(bytes), {
    mapImage: async (s) => s,
    imageCaptionPlaceholder: "Bildbeschreibung hinzufügen",
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    imageRunToken: "pruef01",
  });
  return { html: serverSanitize(reich.html), ids: reich.captionsAmbiguousImageIds };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ start }: { start: string }): JSX.Element {
  const [value, setValue] = useState(start);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: setValue,
    }),
  );
}

async function mount(html: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Host, { start: html }));
  });
}

/** Die Fussnoten im gemounteten Editor: Bildkennung → sichtbare Kennzeichnung (oder keine). */
function fussnoten(): { id: string; kennzeichnung: string | null }[] {
  return Array.from(document.querySelectorAll("figcaption")).map((f) => ({
    id: f.getAttribute("data-image-id") ?? "",
    kennzeichnung: f.getAttribute(CAPTION_AMBIGUOUS_ATTR),
  }));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  merkeMehrdeutigeFussnoten([]);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  merkeMehrdeutigeFussnoten([]);
  await i18n.changeLanguage("de");
});

describe("JOB 3254 · S · der gemountete Editor kennzeichnet die mehrdeutig leere Fussnote", () => {
  it("S1 · am sanitisierten Rumpf steht die Kennzeichnung an (b), nicht an (a)", async () => {
    const { html, ids } = await importiertUndGesichert();
    expect(ids, "Die Vorbedingung fehlt — das Dokument ist nicht mehrdeutig").toHaveLength(2);
    // So legt `Capture.tsx` sie beim Einlesen ab.
    merkeMehrdeutigeFussnoten(ids);
    await mount(html);

    const caps = fussnoten();
    expect(caps, "Es kamen nicht drei Fussnoten im Editor an").toHaveLength(3);
    expect(
      caps[0]?.kennzeichnung,
      "Das Bild ohne jeden Anwärter behauptet eine offene Frage, die es nicht gibt",
    ).toBeNull();
    expect(caps[1]?.kennzeichnung).toBe(i18n.t("editor.captionAmbiguous"));
    expect(caps[2]?.kennzeichnung).toBe(i18n.t("editor.captionAmbiguous"));
    // Und es ist wirklich ein ANDERER Text als die Einladung an (a) — nicht nur eine andere Farbe.
    expect(caps[1]?.kennzeichnung).not.toBe(i18n.t("editor.captionPlaceholder"));
  });

  it("S2 · Sprachwechsel am offenen Editor: die Kennzeichnung steht sofort auf Englisch", async () => {
    const { html, ids } = await importiertUndGesichert();
    merkeMehrdeutigeFussnoten(ids);
    await mount(html);
    const deutsch = i18n.t("editor.captionAmbiguous");
    expect(fussnoten()[1]?.kennzeichnung).toBe(deutsch);

    await act(async () => {
      await i18n.changeLanguage("en");
    });

    const englisch = i18n.t("editor.captionAmbiguous");
    expect(englisch, "Der englische Text ist derselbe — S2 prüfte dann nichts").not.toBe(deutsch);
    expect(
      fussnoten()[1]?.kennzeichnung,
      "Die Kennzeichnung blieb nach dem Sprachwechsel in der alten Sprache stehen",
    ).toBe(englisch);
    expect(fussnoten()[0]?.kennzeichnung, "Der Sprachwechsel hat eine ERFUNDEN").toBeNull();
  });

  it("S3 · GRENZE: ohne die Auskunft dieses Seitenlebens zeigt derselbe Rumpf nichts", async () => {
    const { html } = await importiertUndGesichert();
    // Kein `merkeMehrdeutigeFussnoten` — genau der Zustand nach einem Neuladen der Seite.
    await mount(html);
    for (const c of fussnoten()) {
      expect(
        c.kennzeichnung,
        "Der Rumpf allein trägt die Kennzeichnung — sie wäre damit gespeichert (§10)",
      ).toBeNull();
    }
    // Der gespeicherte Rumpf selbst nennt sie nirgends: sie ist eine Ansicht, kein Inhalt.
    expect(html).not.toContain(CAPTION_AMBIGUOUS_ATTR);
    expect(clientSanitize(html)).not.toContain(CAPTION_AMBIGUOUS_ATTR);
  });
});
