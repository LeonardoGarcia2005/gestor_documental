import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { verifyAccessToken } from "../../lib/jwt.js";
import path from "path";
import { loggerGlobal } from "../../logging/loggerManager.js";

export const getBackupFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    const authHeader = req.headers.authorization;

    if (!fileName)
      return res.status(400).json({ error: "No se proporcionó el nombre del archivo" });

    const file = await filesDAO.getFileByName(fileName);
    if (!file)
      return res.status(404).json({ error: "Archivo no encontrado" });

    if (file.type === "private") {
      if (!authHeader)
        return res.status(401).json({ error: "Token requerido para archivo privado" });

      const token = authHeader.split(" ")[1];
      const decoded = await verifyAccessToken(token).catch(() => null);

      if (!decoded)
        return res.status(401).json({ error: "Token inválido o expirado" });

      if (file.companyCode && file.companyCode !== decoded.companyCode)
        return res.status(403).json({ error: "No tienes permiso para acceder a este archivo" });
    }

    const baseDir =
      file.type === "public"
        ? process.env.PATH_BACKUP_PUBLIC
        : process.env.PATH_BACKUP_PRIVATE;

    const filePath = path.resolve(process.env.BACKEND_URL, baseDir, file.fileName);

    return res.sendFile(filePath)
  } catch (error) {
    loggerGlobal.error("Error en getBackupFile:", {
      error: error.message,
      stack: error.stack,
      fileName,
    });
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};
