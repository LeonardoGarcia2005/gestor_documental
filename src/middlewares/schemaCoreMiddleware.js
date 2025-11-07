import { loggerGlobal } from "../logging/loggerManager.js";

// Middleware de validación con Joi
export const validateSchema = (schema, source = "body", fileMode = null) => {
  return (req, res, next) => {
    try {
      const method = req.method;
      let data = {};

      // Determinar la fuente de datos
      if (source === "query") {
        data = { ...req.query };
        loggerGlobal.info(`Validando desde query: ${JSON.stringify(req.query)}`);
      } else if (source === "params") {
        data = { ...req.params };
        loggerGlobal.info(`Validando desde params: ${JSON.stringify(req.params)}`);
      } else {
        // source === "body" o default
        data = { ...req.body };
      }

      // Procesar archivos según el método y modo
      if (method === "POST") {
        if (fileMode === 'single') {
          // Un solo archivo
          if (req.file) {
            data.file = req.file;
          } else {
            return res.status(400).json({
              message: "Error de validación",
              errors: [{ field: "file", message: "Se requiere un archivo" }],
            });
          }
        } 
        else if (fileMode === 'variants') {
          // Múltiples archivos con el MISMO contexto (variantes)
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({
              message: "Error de validación",
              errors: [{ field: "files", message: "Se requieren archivos" }],
            });
          }

          // Validar deviceType para cada archivo
          const deviceTypesArray = req.body.deviceType
            ? req.body.deviceType.split(",").map((type) => type.trim())
            : [];

          if (deviceTypesArray.length !== req.files.length) {
            return res.status(400).json({
              message: "Error de validación",
              errors: [
                {
                  field: "deviceType",
                  message: `La cantidad de deviceTypes (${deviceTypesArray.length}) debe coincidir con los archivos (${req.files.length})`,
                },
              ],
            });
          }

          // Construir filesData con deviceType para cada variante
          data.filesData = req.files.map((file, index) => ({
            file,
            deviceType: deviceTypesArray[index],
          }));

          // Eliminar deviceType del body raíz (ya está en filesData)
          delete data.deviceType;

          // Marcar como variantes
          req.processingMode = 'variants';
        } 
        else if (fileMode === 'distinct') {
          // Múltiples archivos INDEPENDIENTES
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({
              message: "Error de validación",
              errors: [{ field: "files", message: "Se requieren archivos" }],
            });
          }

          // OPCIÓN A: Metadatos como arrays separados por comas (tu caso actual)
          // channel: "web,api,mobile"
          // documentType: "banner,invoice,photo"
          
          // Extraer arrays de metadatos
          const channels = parseArrayField(req.body.channel);
          const documentTypes = parseArrayField(req.body.documentType);
          const securityLevels = parseArrayField(req.body.securityLevel);
          const hasCompanies = parseArrayField(req.body.hasCompany);
          const typesOfFile = parseArrayField(req.body.typeOfFile);
          const emissionDates = parseArrayField(req.body.emissionDate);
          const expirationDates = parseArrayField(req.body.expirationDate);
          const metadatas = parseArrayField(req.body.metadata);
          
          // deviceType NO se usa en distinct (cada archivo ya es independiente)

          // Validar que haya suficientes valores para cada archivo
          const filesCount = req.files.length;
          
          // Para distinct, cada campo debe tener EXACTAMENTE la misma cantidad que archivos
          // O ser un valor único (que se repite para todos)
          const validateFieldLength = (fieldName, fieldArray) => {
            if (!fieldArray || fieldArray.length === 0) {
              return `El campo ${fieldName} es requerido para archivos distintos`;
            }
            if (fieldArray.length !== filesCount && fieldArray.length !== 1) {
              return `El campo ${fieldName} debe tener ${filesCount} valores (uno por archivo) o un solo valor para todos. Tiene ${fieldArray.length}`;
            }
            return null;
          };

          const errors = [];
          errors.push(validateFieldLength('channel', channels));
          errors.push(validateFieldLength('documentType', documentTypes));
          errors.push(validateFieldLength('securityLevel', securityLevels));
          errors.push(validateFieldLength('hasCompany', hasCompanies));
          errors.push(validateFieldLength('typeOfFile', typesOfFile));
          // deviceType es opcional
          
          const validationErrors = errors.filter(e => e !== null);
          if (validationErrors.length > 0) {
            return res.status(400).json({
              message: "Error de validación para archivos distintos",
              errors: validationErrors.map(msg => ({ message: msg })),
            });
          }

          // Construir filesData con metadatos específicos para cada archivo
          data.filesData = req.files.map((file, index) => {
            // Convertir hasCompany a boolean
            const hasCompanyValue = hasCompanies.length === 1 
              ? parseBoolean(hasCompanies[0])
              : parseBoolean(hasCompanies[index]);

            return {
              file,
              // Si solo hay un valor, usarlo para todos; si no, tomar por índice
              channel: channels.length === 1 ? channels[0] : channels[index],
              documentType: documentTypes.length === 1 ? documentTypes[0] : documentTypes[index],
              securityLevel: securityLevels.length === 1 ? securityLevels[0] : securityLevels[index],
              hasCompany: hasCompanyValue,
              typeOfFile: typesOfFile.length === 1 ? typesOfFile[0] : typesOfFile[index],
              deviceType: deviceTypes?.length > 0 
                ? (deviceTypes.length === 1 ? deviceTypes[0] : deviceTypes[index])
                : null,
              emissionDate: emissionDates?.length > 0
                ? (emissionDates.length === 1 ? emissionDates[0] : emissionDates[index])
                : null,
              expirationDate: expirationDates?.length > 0
                ? (expirationDates.length === 1 ? expirationDates[0] : expirationDates[index])
                : null,
              metadata: metadatas?.length > 0
                ? (metadatas.length === 1 ? metadatas[0] : metadatas[index])
                : null,
            };
          });

          // Marcar como distintos
          req.processingMode = 'distinct';
        }
      } 
      else if (method === "PUT") {
        // Actualización de archivos
        let codesArray = [];

        if (req.body.codes) {
          if (Array.isArray(req.body.codes)) {
            codesArray = req.body.codes.map((code) => code.trim());
          } else if (typeof req.body.codes === "string") {
            codesArray = req.body.codes.split(",").map((code) => code.trim());
          }
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            message: "Error de validación",
            errors: [{ field: "files", message: "Se requiere al menos un archivo" }],
          });
        }

        if (codesArray.length !== req.files.length) {
          return res.status(400).json({
            message: "Error de validación",
            errors: [
              {
                field: "codes",
                message: `La cantidad de códigos (${codesArray.length}) debe coincidir con los archivos (${req.files.length})`,
              },
            ],
          });
        }

        const fileToUpdate = req.files.map((file, index) => ({
          code: codesArray[index],
          file,
        }));

        const hasCompany = req.body.hasCompany === "true" || req.body.hasCompany === true;

        data = {
          fileToUpdate,
          hasCompany,
        };

        req.fileToUpdate = fileToUpdate;

        loggerGlobal.info(`Archivos para actualizar: ${fileToUpdate.length}`);
      }

      // Validación con Joi
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: false,
      });

      if (error) {
        loggerGlobal.error(`Error de validación Joi: ${JSON.stringify(error.details)}`);
        return res.status(400).json({
          message: "Error de validación",
          errors: error.details.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      // Actualizar request con valores validados
      if (source === "query") {
        req.query = { ...req.query, ...value };
        if (value.codes) req.validatedCodes = value.codes.split(",");
      } else if (source === "params") {
        req.params = { ...req.params, ...value };
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

/**
 * Parsea un campo que puede venir como:
 * - String separado por comas: "web,api,mobile"
 * - Array: ["web", "api", "mobile"]
 * - Valor único: "web"
 */
const parseArrayField = (value) => {
  if (!value) return [];
  
  // Si ya es un array, retornarlo limpio
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }
  
  // Si es string, dividir por comas
  if (typeof value === 'string') {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  
  // Cualquier otro tipo, convertir a string y retornar como array de un elemento
  return [String(value).trim()];
}

/**
 * Convierte valores string a boolean de manera segura
 */
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}