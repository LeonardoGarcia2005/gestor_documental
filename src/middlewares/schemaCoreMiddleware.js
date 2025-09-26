import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      let data = { ...req.body };

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