import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { calculateMD5 } from "../../lib/calculateMD5.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";

export const updateMultipleFiles = async (req, res) => {
    try {
        const { files } = req;
        const { oldCodes } = req.body;

        await dbConnectionProvider.tx(async (t) => {
            files.forEach(async (file, index) => {
                // Obtener nombre del archivo
                const fileName = file.originalname;
                const fileSize = file.size;
                const md5 = calculateMD5(file.buffer);

                const oldCode = oldCodes[index];

                // Consulta al archivo por el código viejo
                const fileToUpdate = await filesDAO.getFileByCode(oldCode);

                if (!fileToUpdate) {
                    return res.status(404).json({
                        error: "Archivo no encontrado",
                        details: `El archivo con código ${oldCode} no se encontró en la base de datos.`
                    });
                }

                const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(
                    md5,
                    fileToUpdate.route_rule_id
                );

                if (fileExists) {
                    // Cargar error si el archivo es exactamente igual 
                    return res.status(400).json({
                        message: "El archivo subido a un archivo existente"
                    });
                }

                await filesDAO.updateFile(
                    fileName,
                    oldCode,
                    fileSize,
                    md5,
                    t
                );
            });
        });

        return res.status(200).json({
            message: "Archivos actualizados exitosamente",
        });
    } catch (error) {
        loggerGlobal.error("Error en updateMultipleFiles:", error);
        loggerGlobal.error("Stack trace:", error.stack);

        return res.status(500).json({
            error: "Error procesando los archivos",
            details: error.message,
        });
    }
}