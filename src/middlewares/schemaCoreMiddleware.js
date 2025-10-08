import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      // Valor del tipo de metodo http
      const method = req.method;
      let data = { ...req.body };

      if (method === "POST") {
        // Estructura para POST: crear archivos
        // Determinar si es archivo único o múltiples archivos
        if (req.file) {
          // Archivo único
          data.file = req.file;
        } else if (req.files && req.files.length > 0) {
          // Múltiples archivos
          const deviceTypesArray = req.body.deviceType 
            ? req.body.deviceType.split(',').map(type => type.trim())
            : [];

          data.filesData = req.files.map((file, index) => ({
            file,
            deviceType: deviceTypesArray[index] || null,
          }));
        }
      } else if (method === "PATCH") {
        // Estructura para PATCH: actualizar archivos
        if (req.files && req.files.length > 0) {
          // Múltiples archivos para actualizar
          const oldCodesArray = req.body.oldCode 
            ? req.body.oldCode.split(',').map(code => code.trim())
            : [];

          data.fileToUpdate = req.files.map((file, index) => ({
            oldCode: oldCodesArray[index] || null,
            file,
          }));
        }
      }

      const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Error de validación",
          errors: error.details.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      // Actualizar el body con los valores validados
      req.body = { ...req.body, ...value };
      next();
    } catch (err) {
      loggerGlobal.error("Error en validación:", err);
      return res.status(500).json({
        message: "Error interno en validación",
      });
    }
  };
};