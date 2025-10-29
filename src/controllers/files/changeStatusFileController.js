import { filesDAO } from "../../dataAccessObjects/filesDAO.js"
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../../logging/loggerManager.js";

export const changeStatusFile = async (req, res) => {
  try {
    const { codeFile, isActive } = req.body;

    const result = await dbConnectionProvider.tx(async (t) => {
      // Obtener y bloquear el registro
      const file = await filesDAO.getFileByCodeForUpdate(codeFile, t);

      if (!file) {
        throw new Error(`Archivo con código ${codeFile} no encontrado`);
      }

      // Evaluar que los valores a actualizar no sean los mismos que ya tiene el registro si no lanzar un mensaje de que no se actualizaron los valores
      if (file.is_used === false && isActive === false) {
        return res.status(200).json({
          success: true,
          message: "El archivo ya se encuentra marcado como no usado.",
          data: {
            referenceCount: file.reference_count,
            isUsed: file.is_used,
            isShared: file.is_shared
          }
        });
      }

      // Actualizar todo en UNA SOLA operación atómica
      const updatedFile = await filesDAO.updateFileStatusAtomic(
          file.id,
          isActive,
          t
        );

        if (file.reference_count === 0) {
          loggerGlobal.info(`Archivo ${codeFile} sin referencias. Marcado como no usado.`);
        } else if (file.reference_count === 1) {
          loggerGlobal.info(`Archivo ${codeFile} tiene 1 referencia (no compartido).`);
        } else {
          loggerGlobal.info(`Archivo ${codeFile} tiene ${file.reference_count} referencias (compartido).`);
        }

        return updatedFile;
      });

    return res.status(200).json({
      success: true,
      message: "Estado de archivo actualizado exitosamente",
      data: {
        referenceCount: result.reference_count,
        isUsed: result.is_used,
        isShared: result.is_shared
      }
    });

  } catch (error) {
    loggerGlobal.error("Error en changeStatusFile:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};