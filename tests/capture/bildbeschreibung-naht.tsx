// react BEWUSST relativ aus apps/web/node_modules (kein react im Root) — etabliertes Muster der
// gemounteten Tests seit WP-D8b, siehe tests/types/mounted-react.d.ts.
import { type ReactNode, createElement } from "../../apps/web/node_modules/react";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { ImageDescribeValueProvider } from "../../apps/web/src/app/ImageDescribeContext";

// AUFTRAG-mega50 Block A — DIE NAHT FÜR ISOLIERT GEMOUNTETE EDITOR-TESTS.
//
// Seit mega50 HOLT sich der RichTextEditor den Weg zur Bildbeschreibung aus der App
// (`app/ImageDescribeContext.tsx`), statt ihn als Prop gereicht zu bekommen — genau deshalb kann
// ihn kein Aufrufer mehr vergessen. Tests, die den Editor ohne App montieren, hängen ihren eigenen
// Weg hier ein.
//
// Der Zweck dieser Datei ist, dass es EINE solche Naht gibt und nicht sechs. Die Ursache dieses
// ganzen Auftrags war schließlich, dass derselbe Verdrahtungsblock zweimal im Produktcode stand;
// dieselbe Doppelung im Testbaum zu erzeugen wäre der gleiche Fehler eine Etage tiefer.
export function mitBildbeschreibung(
  kind: ReactNode,
  describe?: (dataUrl: string, context?: string) => Promise<DescribeImageResult>,
  available = true,
): JSX.Element {
  return createElement(ImageDescribeValueProvider, {
    value: {
      available,
      // Voreinstellung für Tests, die die Bildbeschreibung gar nicht auslösen: sie wirft laut,
      // statt still etwas Plausibles zu liefern. Ein Test, der sie doch anfasst, soll das merken.
      describe:
        describe ??
        ((): Promise<DescribeImageResult> => {
          throw new Error("Dieser Test hat keinen describe-Weg verdrahtet.");
        }),
    },
    children: kind,
  });
}
