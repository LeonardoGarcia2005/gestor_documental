import { CronJob } from "cron";
import {
  processExpiredTokenFiles,
  processUnusedFiles,
  createFilesBackup
} from "../../utils/fileLogic.js";

// Job encargado de consultar los archivos que esten con un token en la carpeta temp y removerlos si ya se han expirado
export const deleteExpiredFiles = new CronJob(
  "*/8 * * * *",
  async () => {
    await processExpiredTokenFiles();
  },
  null,
  true,
  "America/Montevideo"
);

// Job encargado de consultar los archivos inutilizados o subidos por error del frontend para eliminarlos
export const findUnusedFiles = new CronJob(
  "0 */4 * * *", // Se ejecuta cada 2 días
  async () => {
    await processUnusedFiles();
  },
  null,
  true,
  "America/Montevideo"
);

// Job encargado de consultar los archivos ya vencidos por la fecha de expiración del documento y esta enfocado en guardar los archivos en otro disco y otra base de datos
export const fetchExpiredFilesByDate = new CronJob(
  "*/1 * * * *",
  async () => {
    await createFilesBackup();
  },
  null,
  true,
  "America/Montevideo"
);
