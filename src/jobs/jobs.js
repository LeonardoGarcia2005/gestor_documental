import { CronJob } from "cron";
import processUnusedFiles from "../services/processUnusedFiles.js";

// Job encargado de consultar los archivos inutilizados o subidos por error del frontend para eliminarlos
export const findUnusedFiles = new CronJob(
  "0 */4 * * *", // Se ejecuta cada 2 dsías
  async () => {
    await processUnusedFiles();
  },
  null,
  true,
  "America/Montevideo"
);