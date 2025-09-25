import path from "path";
import { extensionDAO } from "../dataAccessObjects/extensionDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";
export const attachFileExtensions = async (req, res, next) => {
  try {
    // Solo procesamiento, sin validación
    const extensions = await extensionDAO.getAllExtensions();
    const extMap = new Map(
      extensions.map((ext) => [
        ext.name.toLowerCase(),
        { id: ext.id, name: ext.name },
      ])
    );

    const processFile = (file) => {
      const extFromName = path
        .extname(file.originalname)
        .replace(/^\./, "")
        .toLowerCase();
      
      const dbExt = extMap.get(extFromName);
      
      return {
        cleanName: file.originalname,
        extensionId: dbExt.id,
        extensionName: dbExt.name,
        mimeType: file.mimetype,
        sizeBytes: file.size ?? 0,
        buffer: file.buffer,
      };
    };

    // Solo procesamiento
    const processedFiles = req.files.map(processFile);
    
    req.hasManyFiles = req.files.length > 1;
    if (req.files.length === 1) {
      req.fileInfo = processedFiles[0];
    } else {
      req.processedFiles = processedFiles;
    }

    next();
  } catch (error) {
    loggerGlobal.error("Error en attachFileExtensions", error);
    return res.status(500).json({
      success: false,
      message: "Error al procesar archivo",
    });
  }
};