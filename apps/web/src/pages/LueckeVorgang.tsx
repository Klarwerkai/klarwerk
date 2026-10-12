import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { LueckenVorgang } from "../components/LueckenVorgang";
import { PageHeader } from "../components/ui";

// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DER EINSTIEG IN DEN EIGENEN VORGANG: `/luecke/:id`.
// ================================================================================================
//
// „Risiko & Lücken" ist erst ab Controller erreichbar; Fragende und Fachzuständige sind meist
// Expertinnen oder Betrachter. Ihr Weg in den Vorgang ist diese Seite — erreichbar aus der Glocke
// (Rückfrage, Abschlussmeldung) und aus der Fragenseite, sobald eine Frage zur Lücke wurde.
//
// OHNE `Guarded`, wie `/wissen/:id`: wer beteiligt ist, entscheidet der Server
// (`GET /api/gaps/:id/vorgang` antwortet Unbeteiligten mit 404), und jede Rechteänderung wirkt beim
// nächsten Abruf. Die Seite selbst zeigt nur, was der Server für DIESEN Betrachter ausgibt.
export function LueckeVorgang(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("lueckenvorgang.seite.titel")} lead={t("lueckenvorgang.seite.lead")} />
      <LueckenVorgang key={id} gapId={id} anfangsOffen />
    </div>
  );
}
