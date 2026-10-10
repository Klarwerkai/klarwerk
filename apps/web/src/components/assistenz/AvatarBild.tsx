// produkt:20261010:assistenz-name-avatar — EIN AVATARBILD MIT EHRLICHEM ERSATZ.
//
// Zeigt das Motiv vollständig (`object-contain`, nichts abgeschnitten; das Original randfüllend wie
// bisher, `object-cover` auf seinem quadratischen Bild). Fehlt das Motiv im Katalog
// oder lädt die Datei nicht, steht eine neutrale Ersatzgrafik da — eine geometrische Form, keine
// Person — und `data-avatar-ersatz` sagt, warum. Der Name der Assistenz hängt nie an diesem Bild.
import { useEffect, useState } from "react";
import type { AssistenzAvatarMotiv } from "../../lib/assistenzAvatare";
import { klaraAvatarUrl } from "../klara-vorschau/avatar";

export type AvatarErsatzGrund = "unbekannt" | "datei";

export function AvatarErsatz({
  className = "",
  beschriftung,
  grund,
}: {
  className?: string;
  /** Leer: rein dekorativ (der Name steht daneben). */
  beschriftung: string;
  grund: AvatarErsatzGrund;
}): JSX.Element {
  return (
    <span
      data-testid="assistenz-avatar-ersatz"
      data-avatar-ersatz={grund}
      aria-hidden={beschriftung ? undefined : true}
      className={`grid place-items-center rounded-full bg-hairline-soft text-muted ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" role="img" focusable="false">
        <title>{beschriftung}</title>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </svg>
    </span>
  );
}

export function AvatarBild({
  motiv,
  alt,
  className = "",
  ersatzBeschriftung,
  testId,
  width,
  height,
}: {
  motiv: AssistenzAvatarMotiv | null;
  alt: string;
  className?: string;
  /** Beschriftung der Ersatzgrafik (leer = dekorativ). */
  ersatzBeschriftung: string;
  testId?: string;
  width?: number;
  height?: number;
}): JSX.Element {
  const datei = motiv?.datei ?? null;
  const [defekt, setDefekt] = useState<string | null>(null);
  // Ein neues Motiv bekommt eine neue Chance — der Fehler gilt nur für die Datei, die ihn hatte.
  useEffect(() => {
    setDefekt((vorher) => (vorher === datei ? vorher : null));
  }, [datei]);

  if (datei === null || defekt === datei) {
    return (
      <AvatarErsatz
        className={className}
        beschriftung={ersatzBeschriftung}
        grund={datei === null ? "unbekannt" : "datei"}
      />
    );
  }
  return (
    <img
      // Dieselbe relative Produktadresse wie die ursprüngliche Figur — nie ein fremder Bilddienst.
      src={klaraAvatarUrl(datei)}
      alt={alt}
      draggable={false}
      width={width}
      height={height}
      data-testid={testId}
      data-avatar={motiv?.id}
      onError={() => setDefekt(datei)}
      // Das Original bleibt wie bisher randfüllend; jedes andere Motiv steht vollständig im Rahmen.
      className={`${motiv?.id === "original" ? "object-cover" : "object-contain"} ${className}`}
    />
  );
}
