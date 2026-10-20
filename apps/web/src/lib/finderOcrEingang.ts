import { api } from "../api/client";
import { endpoints } from "../api/endpoints";
// Die bewusst gewählte Mac-Einzeldatei erreicht denselben Dateiimport wie eine Browserauswahl.
// Die bestehende Finder-Herkunftsroute prüft Eigentümer und Aufnahme; kein neuer Dateizugriff.
import i18n from "../i18n";
import { bildInhaltskennung } from "./bildAutomatik";

export async function ladeFinderOcrDatei(objektId: string): Promise<File> {
  const id = encodeURIComponent(objektId);
  const herkunft = await api.get<{
    objektId: string;
    herkunft: {
      quelle: string;
      dateiId: string;
      sha256: string;
      groesse: number;
      bindung: {
        programm: string;
        sitzung: string;
        hostKonto: string;
        objekt: string;
        fassung: string;
      };
    };
  }>(`/klara/programme/finder/${id}`);
  if (
    herkunft.objektId !== objektId ||
    herkunft.herkunft.quelle !== "finder-auswahl" ||
    herkunft.herkunft.bindung?.programm !== "finder" ||
    !herkunft.herkunft.bindung.sitzung ||
    !herkunft.herkunft.bindung.hostKonto ||
    herkunft.herkunft.bindung.objekt !== herkunft.herkunft.dateiId ||
    herkunft.herkunft.bindung.fassung !== herkunft.herkunft.sha256
  ) {
    throw new Error(String(i18n.t("finderocr.herkunft")));
  }
  // Erst nach bestätigter Herkunft lesen. Beide Routen prüfen die aktuelle Sitzung und Rechte.
  const objekt = await endpoints.objects.read(objektId);
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]*)$/.exec(objekt.data);
  if (objekt.ref.id !== objektId || !m || m[1] !== objekt.ref.mime) {
    throw new Error(String(i18n.t("finderocr.nichtLesbar")));
  }
  const bytes = Uint8Array.from(atob(m[2] ?? ""), (c) => c.charCodeAt(0));
  const kennung = await bildInhaltskennung(bytes);
  if (
    bytes.length !== herkunft.herkunft.groesse ||
    kennung !== `sha256:${herkunft.herkunft.sha256}`
  ) {
    throw new Error(String(i18n.t("finderocr.fassung")));
  }
  return new File([bytes], objekt.ref.name, { type: objekt.ref.mime });
}
