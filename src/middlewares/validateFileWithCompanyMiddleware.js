import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

export const validateFileWithCompany = async (req, res, next) => {
    try {
      const { fileToUpdate } = req;
  
      // Extraer todos los códigos del request
      const codes = fileToUpdate.map(f => f.code);
  
      // Buscar en la BD los archivos por código
      const privateFiles = await filesDAO.existSomeFileWithCompany(codes, 'public');
  
      if (privateFiles.length > 0) {
        return res.status(400).json({
          message: "Algunos archivos tienen empresa y no pueden ser actualizados",
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
  