// AUFTRAG-mega14 Block E (SCRUM-421) — die geltenden Upload-Grenzen AN DER AUSWAHLSTELLE.
//
// Der Live-Test ist hieran durchgefallen: die konkreten Grenzen (Anzahl, Größe) standen nur im
// Admin — und der Admin behauptete zugleich, sie würden beim Erfassen angezeigt. Tatsächlich war
// das an genau EINER von zwölf Auswahlstellen der Fall (der Dokumente-Karte im Expertenmodus).
// Das war die schwerere der beiden Falschaussagen.
//
// Diese Komponente ist die EINE Anzeige dafür. Sie holt die Werte aus DERSELBEN Quelle, die der
// Server erzwingt (`GET /api/upload-limits`, siehe services/app/src/routes/ko-routes.ts) — fest
// verdrahtete Zahlen im Frontend sind ausdrücklich verboten: sie werden beim nächsten
// Admin-Wechsel zur nächsten Falschaussage. React Query bündelt die Abfrage, deshalb darf sie an
// jeder Auswahlstelle einzeln stehen.
//
// Solange die Werte noch nicht da sind, wird NICHTS behauptet (kein Platzhalter, keine Vorgabe-
// zahl) — eine falsche Zahl wäre schlechter als keine.

import { QueryClientContext } from "@tanstack/react-query";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useUploadLimits } from "../api/hooks";
import { maxRawAttachmentMb, transferLimitMb } from "../lib/uploadLimits";

// Die Anzeige hängt an einer Serverabfrage, sitzt aber in reinen Darstellungskomponenten, die auch
// isoliert (ohne App-Kontext) gemountet werden. Ohne Abfrage-Kontext behauptet sie deshalb NICHTS,
// statt den Host abstürzen zu lassen. In der Anwendung liegt der Kontext an der Wurzel (main.tsx),
// dort tritt dieser Fall nicht ein — die Abdeckung selbst ist in
// tests/app/upload-limits-visible.test.ts festgeschrieben.
export function UploadLimitsHint(props: { className?: string }): JSX.Element | null {
  return useContext(QueryClientContext) ? <UploadLimitsHintValue {...props} /> : null;
}

function UploadLimitsHintValue({ className }: { className?: string }): JSX.Element | null {
  const { t } = useTranslation();
  const limits = useUploadLimits().data;
  if (!limits) {
    return null;
  }
  return (
    <p data-testid="upload-limits-hint" className={className ?? "mt-1 text-[11px] text-muted-2"}>
      {/* AUFTRAG-mega15 Block E: die eingestellte Grenze misst die ÜBERTRAGENE Daten-URL. Daneben
          steht deshalb die ungefähre Rohdateigrenze — die Zahl, die der Nutzer an seiner Datei
          ablesen kann. Sie ist abgerundet und damit ein Versprechen, das hält
          (lib/uploadLimits.ts, belegt in tests/app/upload-raw-limit-e2e.test.ts). */}
      {t("capture.uploadLimits", {
        count: limits.maxAttachments,
        mb: transferLimitMb(limits.maxAttachmentBytes),
        raw: maxRawAttachmentMb(limits.maxAttachmentBytes),
      })}
    </p>
  );
}
