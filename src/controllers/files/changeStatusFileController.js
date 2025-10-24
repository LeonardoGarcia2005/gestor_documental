import { filesDAO } from "../../dataAccessObjects/filesDAO.js"
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../../logging/loggerManager.js";

export const changeStatusFile = async (req, res) => {
  try {
    const { codeFile, isActive } = req.body;

    let newRefCount = null;
    let file = null;

    await dbConnectionProvider.tx(async (t) => {
      file = await filesDAO.getFileByCode(codeFile);

      if (!file) {
        throw new Error(`Archivo con código ${codeFile} no encontrado`);
      }

      if (!isActive) {
        // DECREMENTAR: Un servicio deja de usar el archivo
        if(file.referenceCount > 0){
          newRefCount = await filesDAO.decrementReferenceCount(file.id, file.referenceCount - 1, t);
        } else {
          newRefCount = 0;
        }

        // Solo marcar como NO USADO si YA NO HAY NINGUNA REFERENCIA
        if (newRefCount === 0) {
          await filesDAO.changeStatusFile(file.id, false);
          await filesDAO.markAsShared(file.id, false, t);
          loggerGlobal.info(`Archivo ${codeFile} sin referencias. Marcado como no usado.`);
        } else if (newRefCount === 1) {
          // Ya no es compartido, pero SIGUE USADO
          await filesDAO.markAsShared(file.id, false, t);
          loggerGlobal.info(`Archivo ${codeFile} ahora tiene 1 referencia (no compartido, pero sigue usado).`);
        } else {
          loggerGlobal.info(`Archivo ${codeFile} aún tiene ${newRefCount} referencias (compartido y usado).`);
        }

      } else {
        // INCREMENTAR: Un servicio empieza a usar el archivo
        newRefCount = await filesDAO.incrementReferenceCount(file.id, file.referenceCount + 1, t);

        // Marcar como USADO (si no lo estaba ya)
        if (!file.isUsed) {
          await filesDAO.changeStatusFile(file.id, true);
        }

        // Marcar como compartido si tiene más de 1 referencia
        if (newRefCount > 1) {
          await filesDAO.markAsShared(file.id, true, t);
          loggerGlobal.info(`Archivo ${codeFile} ahora tiene ${newRefCount} referencias (compartido).`);
        } else {
          loggerGlobal.info(`Archivo ${codeFile} tiene 1 referencia (no compartido).`);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Estado de archivo actualizado exitosamente",
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
