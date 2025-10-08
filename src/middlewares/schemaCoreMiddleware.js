import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema, source = "body", distinct = true) => {
  return (req, res, next) => {
    try {
      let data;

      // Determinar de dónde viene la data
      if (source === "query") {
        data = { ...req.query };
      } else {
        data = { ...req.body };

        // Manejar archivos únicos o múltiples
        if (req.file) {
          data.file = req.file;
        } else if (req.files && req.files.length > 0) {
          const deviceTypesArray = req.body.deviceType
            ? req.body.deviceType.split(",").map((type) => type.trim())
            : [];

          if (distinct) {
            data.filesData = req.files.map((file) => ({
              file,
            }));
          } else {
            data.filesData = req.files.map((file, index) => ({
              file,
              deviceType: deviceTypesArray[index] || null,
            }));
          }
        }
      }

      // Validación con Joi
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

      // Actualizar body o query con los valores validados
      if (source === "query") {
        req.query = { ...req.query, ...value };
        if (value.codes) {
          req.validatedCodes = value.codes.split(",");
        }
      } else {
        req.body = { ...req.body, ...value };
      }

      next();
    } catch (err) {
      loggerGlobal.error("Error en validación:", err);
      return res.status(500).json({
        message: "Error interno en validación",
      });
    }
  };
};
