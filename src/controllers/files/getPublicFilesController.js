
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { checkFileExists } from "../../services/fileSystem.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { buildFileUrl } from "../../lib/builder.js";


export const getPublicFiles = async (req, res) => {
  const { codes } = req.query;

  try {
    // Convertir string separado por comas a array
    const codeArray = codes.split(',').map(code => code.trim());

    const filesProcessed = await Promise.all(
      codeArray.map(async (code) => {
        try {
          // Obtener metadata del archivo
          const fileData = await filesDAO.getFileByCode(code);

          if (!fileData) {
            throw new Error(`Archivo no encontrado: ${code}`);
          }

          // Construir la ruta completa del archivo
          const filePath = await fileParameterValueDAO.buildFilePathFromCode(code);

          // Verificar existencia física (opcional, solo log)
          const exists = await checkFileExists(filePath);
          if (!exists) {
            loggerGlobal.warn(`Archivo físico no encontrado: ${filePath}`);
          }

          const fileUrl = buildFileUrl(filePath);

          return {
            id: fileData.id,
            file_name: fileData.file_name,
            url: fileUrl,
          };

        } catch (error) {
          loggerGlobal.error(`Error procesando archivo ${code}:`, error);
          // Retornar null para filtrar después
          return null;
        }
      })
    );

    // Filtrar los que fallaron (null)
    const successfulFiles = filesProcessed.filter(f => f !== null);

    // Retornar solo el array
    res.status(200).json(successfulFiles);

  } catch (error) {
    loggerGlobal.error("Error en getPublicFiles:", error);
    res.status(500).json({ error: error.message });
  }
};