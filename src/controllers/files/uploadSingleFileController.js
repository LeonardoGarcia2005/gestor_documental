import calculateMD5 from "../../lib/calculateMD5.js";
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";

export const uploadSingleFile = async (req, res) => {
  try {
    const {
      securityContext,
      routePath,
      channelId,
      documentTypeId,
      routeRuleId,
      securityLevelId,
      fileInfo,
    } = req;

    const md5 = calculateMD5(fileInfo.buffer);

    // Validar que el archivo ya no exista en la base de datos
    const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(md5, routeRuleId);
    if (fileExists) {
      return res.status(200).json({
        message: "El archivo ya existe",
        details: {
          urlFile: fileExists.urlFile,
          codeFile: fileExists.codeFile,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Archivo subido exitosamente",
      fileInfo,
    });
  } catch (error) {
    loggerGlobal.error("Error en uploadOneFile:", error);
    return res.status(500).json({
      error: "Error procesando el archivo",
      details: error.message,
    });
  }
};
