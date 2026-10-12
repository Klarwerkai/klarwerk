// OCR-02 · Bilder im Text eines Entwurfs oder Wissensobjekts automatisch lesen.
//
// Der Editor ist der Ort, an dem Bilder Klara im Text bereitgestellt werden: eingefügt, abgelegt,
// aus Word („Klara in Word", H02) oder der Browser-Erweiterung (H04) als Entwurf übernommen, oder
// im gespeicherten Wissensobjekt (Objektspeicher). Diese Komponente hängt an JEDEM RichTextEditor
// und liest die Bilder ohne Klick — Text über W01, Bildinhalt über den Beschreibungsweg der Fläche
// (W02, `useImageDescribe`, mit deren Herkunft und Vertraulichkeitsregel).
//
// Nacharbeit 5 (Bens Befund 1): Der Lauf hängt an den BILDERN, nicht am Text. Ändert sich ein Bild
// (neu, ersetzt, entfernt, verschoben), startet sofort ein neuer Lauf, und der bisherige Befund wird
// im selben Zug durch den laufenden Stand ersetzt — ein ausgetauschtes Bild steht nie mehr mit dem
// alten Ergebnis da. Reine Texteingaben starten nichts neu und schieben nichts auf. Unveränderte
// Bilder werden im neuen Lauf wiedererkannt und nicht erneut gelesen.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribe } from "../app/ImageDescribeContext";
import {
  BILD_AUTOMATIK_VOREINSTELLUNG,
  type BildBeschreiber,
  type BildQuelleEingang,
  type QuellenBefund,
  bildBeschreiberAus,
  gleicheBilder,
  rumpfBildEingang,
} from "../lib/bildAutomatik";
import { neueBildAnalyse } from "../lib/bildAutomatikLauf";
import { BildBefundListe } from "./BildBefundListe";

interface Gestartet {
  eingang: BildQuelleEingang;
  beschreibe: BildBeschreiber;
}

export function BildBefundeImRumpf({ html }: { html: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { available, describe } = useImageDescribe();
  // Ein Exemplar je Editor: dort werden unveränderte Bilder wiedererkannt.
  const [analyse] = useState(neueBildAnalyse);
  const [befund, setBefund] = useState<{ lauf: number; befund: QuellenBefund } | null>(null);
  const laufRef = useRef(0);
  const gestartetRef = useRef<Gestartet | null>(null);
  const beschreibe = useMemo(
    () => bildBeschreiberAus({ available, describe }),
    [available, describe],
  );
  const name = t("bildautomatik.quelle.rumpf");
  const eingang = useMemo(() => rumpfBildEingang(name, html), [name, html]);

  useEffect(() => {
    const vorher = gestartetRef.current;
    if (
      vorher &&
      vorher.beschreibe === beschreibe &&
      gleicheBilder(vorher.eingang.vorkommen, eingang.vorkommen)
    ) {
      return; // Nur Text geändert: der laufende bzw. fertige Befund gilt weiter.
    }
    gestartetRef.current = { eingang, beschreibe };
    laufRef.current += 1;
    const lauf = laufRef.current;
    if (eingang.vorkommen.length === 0) {
      setBefund(null);
      return;
    }
    // Sofort: der erste Zwischenstand (alle Bilder „wartet“/„läuft“) ersetzt den alten Befund noch
    // vor dem ersten Lesezugriff.
    void analyse.analysiereQuelle(eingang, {
      automatik: BILD_AUTOMATIK_VOREINSTELLUNG,
      beschreibe,
      onFortschritt: (stand) => {
        if (laufRef.current === lauf) {
          setBefund({ lauf, befund: stand });
        }
      },
    });
  }, [analyse, beschreibe, eingang]);

  if (!befund) {
    return null;
  }
  return (
    <div data-testid="rumpf-bild-befunde" className="border-t border-hairline p-2">
      <BildBefundListe befund={befund.befund} lauf={befund.lauf} />
    </div>
  );
}
