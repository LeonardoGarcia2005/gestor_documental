import { loggerGlobal } from "../logging/loggerManager.js";

export const validateSchema = (schema, source = "body", distinct = true) => {
  return (req, res, next) => {
    try {
      let data = {};
      const method = req.method;

      // Si source es "query", SIEMPRE usar query independientemente del método
      if (source === "query") {
        data = { ...req.query };
        loggerGlobal.info(
          `Validando desde query params: ${JSON.stringify(req.query)}`
        );
      }
      // Si source es "body" o no especificado, procesar según el método
      else if (method === "POST") {
        // Validación para creación
        data = { ...req.body };

        if (req.file) {
          data.file = req.file;
        } else if (req.files && req.files.length > 0) {
          if (distinct) {
            // Archivos DISTINTOS: sin deviceType
            data.filesData = req.files.map((file) => ({ file }));
            req.isDistinctFiles = true;
          } else {
            // Archivos VARIANTS: con deviceType
            const deviceTypesArray = req.body.deviceType
              ? req.body.deviceType.split(",").map((type) => type.trim())
              : [];

            // Validar que haya suficientes deviceTypes
            if (deviceTypesArray.length !== req.files.length) {
              return res.status(400).json({
                message: "Error de validación",
                errors: [
                  {
                    field: "deviceType",
                    message: `La cantidad de tipos de dispositivo (${deviceTypesArray.length}) debe coincidir con la cantidad de archivos (${req.files.length})`,
                  },
                ],
              });
            }

            data.filesData = req.files.map((file, index) => ({
              file,
              deviceType: deviceTypesArray[index],
            }));
            req.isDistinctFiles = false;
          }

          // ← CRÍTICO: Eliminar deviceType del body raíz porque ya se movió a filesData
          delete data.deviceType;
        }
      } else if (method === "PUT") {
        // Validación para actualización
        let codesArray = [];

        if (req.body.codes) {
          if (Array.isArray(req.body.codes)) {
            codesArray = req.body.codes.map((code) => code.trim());
          } else if (typeof req.body.codes === "string") {
            codesArray = req.body.codes.split(",").map((code) => code.trim());
          }
        }

        // Validar que haya archivos
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
          return res.status(400).json({
            message: "Error de validación",
            errors: [
              { field: "files", message: "Se requiere al menos un archivo" },
            ],
          });
        }

        // Validar que haya la misma cantidad de codes que files
        if (codesArray.length !== req.files.length) {
          return res.status(400).json({
            message: "Error de validación",
            errors: [
              {
                field: "codes",
                message: `La cantidad de códigos (${codesArray.length}) debe coincidir con la cantidad de archivos (${req.files.length})`,
              },
            ],
          });
        }

        const fileToUpdate = req.files.map((file, index) => ({
          code: codesArray[index],
          file,
        }));

        // Convertir hasCompany a boolean si viene como string
        const hasCompany =
          req.body.hasCompany === "true" || req.body.hasCompany === true;

        data = {
          fileToUpdate,
          hasCompany,
        };

        // Guardar en req para uso posterior
        req.fileToUpdate = fileToUpdate;

        loggerGlobal.info(`Archivos para actualizar: ${fileToUpdate.length}`);
        loggerGlobal.debug(
          `Datos transformados para PUT: ${JSON.stringify({
            fileToUpdate: fileToUpdate.map((f) => ({
              code: f.code,
              fileName: f.file.originalname,
            })),
            hasCompany,
          })}`
        );
      } else {
        // Para otros métodos (GET, DELETE, etc.), usar body por defecto
        data = { ...req.body };
      }

      // Validación con Joi
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: false, // Cambiar a false para ser más estricto
      });

      if (error) {
        loggerGlobal.error(
          `Error de validación Joi: ${JSON.stringify(error.details)}`
        );
        return res.status(400).json({
          message: "Error de validación",
          errors: error.details.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      // Actualizar body/query según source
      if (source === "query") {
        req.query = { ...req.query, ...value };
        if (value.codes) req.validatedCodes = value.codes.split(",");
      } else {
        req.body = { ...req.body, ...value };
      }

      loggerGlobal.info(`Validación exitosa para ${method} ${req.path}`);
      next();
    } catch (err) {
      loggerGlobal.error("Error en validación:", err);
      return res.status(500).json({
        message: "Error interno en validación",
        details: err.message,
      });
    }
  };
};
