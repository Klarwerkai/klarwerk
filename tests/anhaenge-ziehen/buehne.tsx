// ================================================================================================
// ANHÄNGE ZIEHEN · DIE BÜHNE IM ECHTEN BROWSER — der echte RichTextEditor, sonst nichts.
// ================================================================================================
//
// Diese Datei läuft NICHT unter Vitest, sondern in Chromium: `ziehen-im-browser-chromium.test.ts`
// startet einen Vite-Entwicklungsserver über `apps/web` und lädt sie als Modul. Vite übersetzt den
// Editor dabei genau wie im Entwicklungsbetrieb (TSX, `import.meta.glob` der Texte, React aus
// `apps/web/node_modules`). Kein nachgebautes Markup, keine Attrappe des Editors.
//
// `react` und `react-dom/client` stehen hier BEWUSST als nackte Namen: Vite löst sie auf die
// vorgebündelten Abhängigkeiten von `apps/web` auf — dieselbe React-Instanz, die der Editor nimmt.
// Ein Pfad bis in `node_modules` hinein bekäme eine zweite, rohe CommonJS-Kopie.
//
// Was die Probe von außen braucht, steht an `window.__buehne`: montieren, den zuletzt gemeldeten
// Stand lesen, und den Neuladeweg (Sanitizer an der Persistenzgrenze → frisch montierter Editor).
import { createElement, useState } from "react";
import { type Root, createRoot } from "react-dom/client";
import { ImageDescribeValueProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { type EditorImage, RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import type { EditorFile } from "../../apps/web/src/lib/bodyFileLink";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";

// Die Listen der Fläche — wörtlich gespiegelt in `ziehen-im-browser-chromium.test.ts` (dort gesucht
// wird nach dem sichtbaren Namen, so wie ein Mensch den Eintrag findet).
const BILDER: EditorImage[] = [{ objectId: "obj-pumpe", name: "Pumpe.png" }];
const DATEIEN: EditorFile[] = [
  { objectId: "obj-plan", name: "Wartungsplan.pdf", mime: "application/pdf" },
];

let wurzel: Root | null = null;
let gemeldet = "";
let meldungen = 0;

function Host({ start }: { start: string }): JSX.Element {
  const [value, setValue] = useState(start);
  return (
    <ImageDescribeValueProvider
      value={{
        available: false,
        describe: () => Promise.reject(new Error("Die Bühne beschreibt keine Bilder.")),
      }}
    >
      <RichTextEditor
        value={value}
        documentTitle="Wartung Pumpe"
        images={BILDER}
        files={DATEIEN}
        onChange={(html: string) => {
          gemeldet = html;
          meldungen += 1;
          setValue(html);
        }}
      />
    </ImageDescribeValueProvider>
  );
}

function montiere(start: string): void {
  wurzel?.unmount();
  const ziel = document.getElementById("wurzel");
  if (!ziel) {
    throw new Error("Die Bühne hat kein #wurzel");
  }
  gemeldet = "";
  meldungen = 0;
  wurzel = createRoot(ziel);
  wurzel.render(createElement(Host, { start }));
}

(window as unknown as { __buehne: unknown }).__buehne = {
  montiere,
  gemeldet: (): string => gemeldet,
  meldungen: (): number => meldungen,
  // Speichern und Wiederöffnen: derselbe Sanitizer wie an der Persistenzgrenze, dann ein frisch
  // montierter Editor auf genau diesem Stand.
  neuLaden: (): string => {
    const gespeichert = sanitizeHtml(gemeldet);
    montiere(gespeichert);
    return gespeichert;
  },
  t: (schluessel: string): string => i18n.t(schluessel),
};
