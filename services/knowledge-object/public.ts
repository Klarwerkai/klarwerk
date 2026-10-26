// Schmale öffentliche Lese-API: dieselben Regeln, ohne KO-Dienste und Datenbankadapter zu laden.
export { isConfidential } from "./src/confidentiality";
export { sqlDeletedAtLeer } from "./src/sql-deleted-at";

export { darfInFreieAusgabe } from "./src/ausgabe-schutz";
