// OCR-02 · Office im Artikel (H06, Lücke L17): die eingebetteten Bilder einer angehängten bzw. als
// neue Fassung übernommenen `.pptx`/`.docx` werden ohne Klick gelesen.
//
// DER WEG IST DER VORHANDENE: die Bytes kommen aus dem Objektspeicher des Anhangs
// (`/api/objects/<id>/raw`, mit den Rechten des Artikels), gelesen mit denselben Lesern wie der
// Dateiimport (W03 `readPptxRich`, W05 `readDocxRich`), erkannt mit W01, der Bildinhalt über W02 mit
// der Herkunft des Artikels. Es gibt keine Schreibstelle: Anhang und Fassung bleiben unverändert.
//
// Der Befund gehört zu GENAU DIESER Fassung (Objektkennung). Eine neue Fassung ist ein neuer Lauf;
// unveränderte Bilder darin werden wiedererkannt und nicht erneut gelesen.
//
// Excel (`.xlsx`) hat keinen Leser (Q08) — dort wird nichts behauptet.
import { useEffect, useMemo, useState } from "react";
import { useImageDescribeWennVorhanden } from "../../app/ImageDescribeContext";
import {
  BILD_AUTOMATIK_VOREINSTELLUNG,
  type BildQuelleEingang,
  type QuellenBefund,
  bildBeschreiberAus,
  docxBildEingang,
  pptxBildEingang,
} from "../../lib/bildAutomatik";
import { neueBildAnalyse } from "../../lib/bildAutomatikLauf";
import { objectRawHref } from "../../lib/bodyFileLink";
import { readDocxRich, readPptxRich } from "../../lib/files";
import { BildBefundListe } from "../BildBefundListe";

export interface OfficeBildAnhang {
  id: string;
  name: string;
  objectId: string;
}

type Art = "pptx" | "docx";

/** Welche Office-Anhänge einen Leser haben. */
export function officeBildArt(name: string): Art | null {
  const endung = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return endung === "pptx" ? "pptx" : endung === "docx" ? "docx" : null;
}

/** Den Anhang über den vorhandenen Objektspeicherweg holen und mit dem passenden Leser lesen. */
export async function officeBildEingang(
  anhang: OfficeBildAnhang,
  art: Art,
  laden: (href: string) => Promise<Blob | null>,
): Promise<BildQuelleEingang | null> {
  const href = objectRawHref(anhang.objectId);
  const blob = href ? await laden(href) : null;
  if (!blob) {
    return null;
  }
  const datei = new File([blob], anhang.name, { type: blob.type });
  if (art === "pptx") {
    const pptx = await readPptxRich(datei, "");
    return pptxBildEingang(anhang.name, pptx.html, pptx);
  }
  const docx = await readDocxRich(datei, "");
  return docxBildEingang(anhang.name, docx.html, docx.droppedImages);
}

async function ladeAnhang(href: string): Promise<Blob | null> {
  const antwort = await fetch(href, { credentials: "same-origin" });
  return antwort.ok ? antwort.blob() : null;
}

/** Ohne Zugriff auf den Anhang ist nichts gelesen — und das steht da. */
function ohneZugriff(name: string, art: Art): QuellenBefund {
  return {
    quelle: name,
    art,
    status: "fehlgeschlagen",
    befunde: [],
    nichtGelesen: [],
    hinweise: [],
  };
}

export function OfficeBildBefunde({
  anhaenge,
}: {
  anhaenge: OfficeBildAnhang[];
}): JSX.Element | null {
  const weg = useImageDescribeWennVorhanden();
  const [analyse] = useState(neueBildAnalyse);
  const [befunde, setBefunde] = useState<Record<string, QuellenBefund>>({});
  const beschreibe = useMemo(() => (weg ? bildBeschreiberAus(weg) : undefined), [weg]);
  const lesbar = anhaenge.filter((a) => officeBildArt(a.name) !== null);
  // Der Schlüssel ist die FASSUNG (Objektkennung): eine neue Fassung startet einen neuen Lauf.
  const schluessel = lesbar.map((a) => `${a.id}:${a.objectId}`).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `schluessel` bündelt Anhang und Fassung.
  useEffect(() => {
    let aktiv = true;
    for (const anhang of lesbar) {
      const art = officeBildArt(anhang.name);
      if (!art) {
        continue;
      }
      void (async () => {
        let eingang: BildQuelleEingang | null = null;
        try {
          eingang = await officeBildEingang(anhang, art, ladeAnhang);
        } catch {
          eingang = null;
        }
        if (!aktiv) {
          return;
        }
        if (!eingang) {
          setBefunde((b) => ({ ...b, [anhang.objectId]: ohneZugriff(anhang.name, art) }));
          return;
        }
        await analyse.analysiereQuelle(eingang, {
          automatik: BILD_AUTOMATIK_VOREINSTELLUNG,
          beschreibe,
          onFortschritt: (stand) => {
            if (aktiv) {
              setBefunde((b) => ({ ...b, [anhang.objectId]: stand }));
            }
          },
        });
      })();
    }
    return () => {
      aktiv = false;
    };
  }, [schluessel, analyse, beschreibe]);

  const sichtbar = lesbar.flatMap((a) => {
    const befund = befunde[a.objectId];
    return befund ? [{ a, befund }] : [];
  });
  if (sichtbar.length === 0) {
    return null;
  }
  return (
    <div data-testid="office-bild-befunde" className="space-y-2">
      {sichtbar.map(({ a, befund }) => (
        <div key={`${a.id}-${a.objectId}`} data-office-bild-befund={a.id}>
          <BildBefundListe befund={befund} />
        </div>
      ))}
    </div>
  );
}
