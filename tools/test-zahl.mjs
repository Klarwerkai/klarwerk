// Zusätzlicher Reporter: ein eigener --reporter darf die Gesamtsumme nicht ausblenden.
import { writeFileSync } from "node:fs";
export default class TestZahl {
  onFinished(files = []) {
    let count = 0;
    const visit = (task) => {
      if (task.tasks) task.tasks.forEach(visit);
      else if (["pass", "fail"].includes(task.result?.state)) count++;
    };
    files.forEach(visit);
    writeFileSync(process.env.KLARWERK_TEST_ZAHL_DATEI, JSON.stringify({ count }));
  }
}
