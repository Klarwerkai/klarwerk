// ================================================================================================
// AUFTRAG-mega46 BLOCK F2 — EINE FLÄCHE, DEREN SCHALTER AUS IST, WIRD GAR NICHT GERENDERT.
// ================================================================================================
//
// Nicht ausgegraut, nicht mit Hinweis, nicht als Fehler: gar nicht. Ein ausgegrauter Knopf ist eine
// Zumutung — er verspricht etwas, was dieser Betrieb nicht hat, und erzeugt eine Frage, die niemand
// beantworten kann („warum kann ich das nicht anklicken?"). Ein Fehler nach dem Klick ist noch
// schlechter: Er sieht aus wie ein Defekt, obwohl alles in Ordnung ist.
//
// DIE REGEL STEHT GENAU HIER, EINMAL — und deshalb gibt es diesen Baustein überhaupt. Jede künftige
// geschaltete Fläche wickelt sich hier hinein, statt selbst `features.data?.x` abzufragen und dabei
// den heiklen Teil zu vergessen: Solange die Auskunft noch NICHT da ist (Laden) oder NICHT kommt
// (Fehler, Abmeldung), gilt der Schalter als AUS. Fail-closed in die richtige Richtung — lieber
// erscheint eine Fläche einen Wimpernschlag später, als dass sie kurz aufblitzt und wieder
// verschwindet oder ins Leere führt.
//
// KEIN EIGENER TEXT, KEINE EIGENE OPTIK: Der Baustein rendert entweder seine Kinder oder nichts.
// Damit braucht er keine Übersetzung und kann keine Zeichenkette hartkodieren.
import type { ReactNode } from "react";
import { useFeatures } from "../api/hooks";
import type { FeatureName } from "../api/types";

export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureName;
  children: ReactNode;
}): JSX.Element | null {
  const features = useFeatures();
  // `?? false`: Zwischen „noch nicht geladen", „Server hat nicht geantwortet" und „ausgeschaltet"
  // wird für die Anzeige NICHT unterschieden — alle drei bedeuten: nicht rendern.
  const an = features.data?.features[feature] ?? false;
  return an ? <>{children}</> : null;
}
