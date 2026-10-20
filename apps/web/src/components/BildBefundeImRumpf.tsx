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
//
// OCR-03 (produkt:20261012:klara-bildanalyse-ocr-kontext-setup):
//   · Die Einstellung Setup › Klara „Bilder automatisch analysieren und Text erkennen“ wirkt hier:
//     aus → kein neuer automatischer Lauf (vorhandene Ergebnisse bleiben sichtbar), Profil lädt →
//     warten, Profil nicht lesbar → nicht lesen und das sagen. Ein Wechsel der Einstellung ist ein
//     neuer Lauf; der überholte bricht vor dem nächsten Bild ab.
//   · Die Analyse gehört zum angemeldeten Konto (`useBildAnalyse`) — kein Ergebnis eines anderen
//     Kontos wird wiederverwendet.
//   · Unter dem Befund: Klara zu diesem Inhalt fragen (Text UND erkannte Bilder, mit Fundstelle).
//
// OCR-E01/E02 (produkt:20261012:klara-ocr-fundstellen-korrekturen): jedes Wort öffnet sein Bild im
// Text mit markierter Stelle; berichtigt wird gebunden an die gespeicherte Quelle dieser Fläche
// (`ko:<id>`/`entwurf:<id>` aus der Provenienz) und die Bildfassung — Klara fragt mit dem
// berichtigten Text.
//   · OCR-E06: darunter „Klara, was steht hier?“ — ein Bild oder einen Bereich darin auswählen.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribe } from "../app/ImageDescribeContext";
import {
  type BildAnalyse,
  type BildBeschreiber,
  type BildQuelleEingang,
  type QuellenBefund,
  bildBeschreiberAus,
  einstellungUnbekannt,
  gleicheBilder,
  rumpfBildEingang,
} from "../lib/bildAutomatik";
import { type BildAutomatikLage, useBildAutomatikLage } from "../lib/bildAutomatikEinstellung";
import { useBildAnalyse } from "../lib/bildAutomatikLauf";
import { originalAusEingang } from "../lib/bildFundstelle";
import { htmlToPlainText } from "../lib/richText";
import { BildBefundListe } from "./BildBefundListe";
import { KlaraBereichsfrage } from "./KlaraBereichsfrage";
import { KlaraBildKontextFrage } from "./KlaraBildKontextFrage";

interface Gestartet {
  eingang: BildQuelleEingang;
  beschreibe: BildBeschreiber;
  analyse: BildAnalyse;
  lage: BildAutomatikLage;
}

export function BildBefundeImRumpf({ html }: { html: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { available, describe, quelle } = useImageDescribe();
  // Ein Exemplar je Editor und Konto: dort werden unveränderte Bilder wiedererkannt.
  const analyse = useBildAnalyse();
  const lage = useBildAutomatikLage();
  const [befund, setBefund] = useState<{
    lauf: number;
    befund: QuellenBefund;
    eingang: BildQuelleEingang;
  } | null>(null);
  const laufRef = useRef(0);
  const gestartetRef = useRef<Gestartet | null>(null);
  const beschreibe = useMemo(
    () => bildBeschreiberAus({ available, describe }),
    [available, describe],
  );
  const name = t("bildautomatik.quelle.rumpf");
  const eingang = useMemo(() => rumpfBildEingang(name, html), [name, html]);

  useEffect(() => {
    if (lage === "laedt") {
      return; // Die Einstellung des Kontos kommt gleich — bis dahin wird nichts gestartet.
    }
    const vorher = gestartetRef.current;
    if (
      vorher &&
      vorher.beschreibe === beschreibe &&
      vorher.analyse === analyse &&
      vorher.lage === lage &&
      gleicheBilder(vorher.eingang.vorkommen, eingang.vorkommen)
    ) {
      return; // Nur Text geändert: der laufende bzw. fertige Befund gilt weiter.
    }
    gestartetRef.current = { eingang, beschreibe, analyse, lage };
    laufRef.current += 1;
    const lauf = laufRef.current;
    if (eingang.vorkommen.length === 0) {
      setBefund(null);
      return;
    }
    if (lage === "unbekannt") {
      setBefund({ lauf, befund: einstellungUnbekannt(eingang), eingang });
      return;
    }
    // Sofort: der erste Zwischenstand (alle Bilder „wartet“/„läuft“) ersetzt den alten Befund noch
    // vor dem ersten Lesezugriff.
    void analyse.analysiereQuelle(eingang, {
      automatik: lage === "an",
      beschreibe,
      abbrechen: () => laufRef.current !== lauf,
      onFortschritt: (stand) => {
        if (laufRef.current === lauf) {
          setBefund({ lauf, befund: stand, eingang });
        }
      },
    });
  }, [analyse, beschreibe, eingang, lage]);

  // Der Text, den Klara neben den Bildbefunden bekommt — derselbe Klartext wie für die KI-Palette
  // (`bodyTextForAssist`), erst beim Fragen aus dem aktuellen Rumpf gebildet.
  const htmlRef = useRef(html);
  htmlRef.current = html;
  const dokumentTextVon = useMemo(() => () => htmlToPlainText(htmlRef.current), []);
  const quellen = useMemo(() => (befund ? [befund.befund] : []), [befund]);
  const aktuell = useMemo(() => (befund ? [befund.eingang] : undefined), [befund]);

  if (!befund) {
    return null;
  }
  const eingangJetzt = befund.eingang;
  return (
    <div data-testid="rumpf-bild-befunde" className="border-t border-hairline p-2">
      <BildBefundListe
        befund={befund.befund}
        lauf={befund.lauf}
        originalVon={(b) => originalAusEingang(eingangJetzt, b.fundstelle)}
        korrekturQuelle={quelle ?? null}
      />
      <KlaraBildKontextFrage
        kontextSchluessel={`rumpf:${befund.lauf}`}
        dokumentTextVon={dokumentTextVon}
        quellen={quellen}
        aktuell={aktuell}
        korrekturQuelle={quelle ?? null}
      />
      <KlaraBereichsfrage
        analyse={analyse}
        korrekturQuelle={quelle ?? null}
        kontextSchluessel={`rumpf:${befund.lauf}`}
        quellen={quellen}
        aktuell={aktuell}
      />
    </div>
  );
}
