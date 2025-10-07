import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

export const validatePublicFiles = async (req, res, next) => {
  try {
    let codesArray;

    // Detectar de dónde vienen los códigos
    if (req.query.codes) {
      // Viene del query: "FILE-606CC315,FILE-ABC123"
      codesArray = req.query.codes.split(',').map(code => code.trim());
    } else if (req.body.files) {
      // Viene del body: [{ code: "FILE-606CC315" }, { code: "FILE-ABC123" }]
      codesArray = req.body.files.map(f => f.code);
    } else {
      return res.status(400).json({
        message: "Debe proporcionar códigos de archivos"
      });
    }

    // Buscar en la BD los archivos por código
    const privateFiles = await filesDAO.existSomePrivateFile(codesArray);

    if (privateFiles.length > 0) {
      return res.status(400).json({
        message: "Algunos archivos son privados y no pueden consultarse en este endpoint",
        invalidCodes: privateFiles.map(f => f.code)
      });
    }

    next();
  } catch (error) {
    loggerGlobal.error("Error validando archivos públicos", { error });
    return res.status(500).json({ message: "Error validando archivos públicos" });
  }
};