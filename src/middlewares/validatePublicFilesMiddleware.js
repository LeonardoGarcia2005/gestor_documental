import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

export const validatePublicFiles = async (req, res, next) => {
    try {
      const { files } = req.body;
  
      // Extraer todos los códigos del request
      const codes = files.map(f => f.code);
  
      // Buscar en la BD los archivos por código
      const privateFiles = await filesDAO.existSomeFileWithCompany(codes);
  
      if (privateFiles.length > 0) {
        return res.status(400).json({
          message: "Algunos archivos son privados y no pueden consultarse en este endpoint",
          invalidCodes: privateFiles.map(f => f.code)
        });
      }
  
      // Todo bien → sigue el flujo
      next();
    } catch (error) {
      loggerGlobal.error("Error validando archivos públicos", { error });
      return res.status(500).json({ message: "Error validando archivos públicos" });
    }
  };
  