import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      const mappedFiles = req.files
        ? req.files.map((file) => {
            return { file: file };
          })
        : [];

      const data = {
        ...req.body,
        file: req.files[0],
        files: mappedFiles,
      };

      // Solo validar el body directamente, no un objeto anidado
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: true, // Permitir campos adicionales como 'file'
        stripUnknown: false, // No eliminar campos desconocidos
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
