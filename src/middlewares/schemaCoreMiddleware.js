import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema, source = "body", distinct = true) => {
  return (req, res, next) => {
    try {
      let data = {};
      const method = req.method;

      if (method === "POST") {
        // Validación para creación
        if (source === "query") {
          data = { ...req.query };
        } else {
          data = { ...req.body };

          if (req.file) {
            data.file = req.file;
          } else if (req.files && req.files.length > 0) {
            const deviceTypesArray = req.body.deviceType
              ? req.body.deviceType.split(",").map((type) => type.trim())
              : [];

            if (distinct) {
              data.filesData = req.files.map((file) => ({ file }));
            } else {
              data.filesData = req.files.map((file, index) => ({
                file,
                deviceType: deviceTypesArray[index] || null,
              }));
            }
          }
        }
      } else if (method === "PUT") {
        // Validación para actualización
        const codesArray = req.body.codes
          ? req.body.codes.split(",").map((code) => code.trim())
          : [];

        const fileToUpdate = Array.isArray(req.files)
          ? req.files.map((file, index) => ({
              code: codesArray[index] || null,
              file,
            }))
          : [];

        req.fileToUpdate = fileToUpdate;

        data = {
          ...req.body,
          fileToUpdate,
        };

        loggerGlobal.info(`Archivos para actualizar: ${fileToUpdate.length}`);
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

      // Actualizar body/query
      if (source === "query") {
        req.query = { ...req.query, ...value };
        if (value.codes) req.validatedCodes = value.codes.split(",");
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
