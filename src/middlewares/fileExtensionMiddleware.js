import path from "path";
import { extensionDAO } from "../dataAccessObjects/extensionDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";
import { getImageDimensionsWithLibrary } from "../lib/imageSize.js";

export const attachFileExtensions = async (req, res, next) => {
  try {
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

      // Obtener la resolucion del archivo
      const dimensions = getImageDimensionsWithLibrary(file.buffer);
      const dbExt = extMap.get(extFromName);

      // Validar que la extensión exista en la base de datos
      if (!dbExt) {
        throw new Error(`Extensión no soportada: ${extFromName}`);
      }

      return {
        cleanName: file.originalname,
        extensionId: dbExt.id,
        extensionName: dbExt.name,
        mimeType: file.mimetype,
        ...(dimensions?.resolution ? { resolution: dimensions.resolution } : {}),
        sizeBytes: file.size ?? 0,
        buffer: file.buffer,
      };
    };

    // Distinguir entre archivo único y múltiples archivos
    if (req.file) {
      // Archivo único
      req.fileInfo = processFile(req.file);
      req.isForMultiFile = false;
    } else if (req.files && req.files.length > 0) {
      // Múltiples archivos
      req.processedFiles = req.files.map(processFile);
      req.isForMultiFile = true;
    } else {
      // No hay archivos
      req.isForMultiFile = false;
    }

    next();
  } catch (error) {
    loggerGlobal.error("Error en attachFileExtensions", error);
    
    // Respuesta más específica según el tipo de error
    if (error.message && error.message.includes("Extensión no soportada")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Error al procesar archivo",
    });
  }
};