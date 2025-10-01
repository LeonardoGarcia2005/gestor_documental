import { routeRuleDAO } from "../dataAccessObjects/routeRuleDAO.js";
import { channelDAO } from "../dataAccessObjects/channelDAO.js";
import { documentTypeDAO } from "../dataAccessObjects/documentTypeDAO.js";
import { getParameterValue } from "../lib/routeParameterMappings.js";
import { securityLevelDAO } from "../dataAccessObjects/securityLevelDAO.js";

export const applyRouteRule = async (req, res, next) => {
  try {
    const rawValues = req.body;
    const { securityContext, isForMultiFile } = req;
    const httpMethod = req.method;

    if (!securityContext) {
      return res.status(500).json({
        error: "Contexto de seguridad no establecido",
      });
    }

    // Valores base compartidos
    const baseValues = {
      ...rawValues,
      isForMultiFile,
      ...(securityContext.companyCode
        ? { companyCode: securityContext.companyCode }
        : {}),
    };

    // Realizar las consultas comunes una sola vez (incluida la regla de ruta)
    const [channelExists, documentTypeExists, securityLevel, routeParameters] =
      await Promise.all([
        channelDAO.existsChannel(baseValues.channel),
        documentTypeDAO.existDocumentType(baseValues.documentType),
        securityLevelDAO.getSecurityByType(baseValues.securityLevel),
        routeRuleDAO.getRouteRuleBySecurityAndCompany(baseValues, httpMethod),
      ]);

    if (!channelExists.exists) {
      return res.status(404).json({
        error: "No se encontró el canal especificado en la base de datos",
      });
    }

    if (!documentTypeExists) {
      return res.status(404).json({
        error: "No se encontró el tipo de documento en la base de datos",
      });
    }

    if (!routeParameters || routeParameters.length === 0) {
      return res.status(500).json({
        error: `No se encontró una regla de ruta para securityLevel: ${baseValues.securityLevel}, hasCompany: ${baseValues.hasCompany}`,
      });
    }

    // Procesar rutas según el tipo
    if (isForMultiFile) {
      // Múltiples archivos
      const originalProcessed = Array.isArray(req.processedFiles)
        ? req.processedFiles
        : [];

      const enrichedFiles = req.body.filesData.map((fileData, i) => {
        const original = originalProcessed[i] || {};
        const fileSpecificValues = {
          ...baseValues,
          fileIndex: i,
          deviceType: fileData.deviceType,
          ...(original.resolution ? { resolution: original.resolution } : {}),
        };

        const { routePath, routeParameterValues } = buildRoutePathWithParameters(routeParameters, fileSpecificValues);

        return {
          ...original,
          fileIndex: i,
          deviceType: fileData.deviceType,
          routePath,
          routeRuleId: routeParameters[0].route_rule_id,
          originalFile: fileData.file,
          routeParameterValues, // Agregar los valores de parámetros para cada archivo
          ...(original.resolution
            ? { dimensions: { resolution: original.resolution } }
            : {}),
        };
      });

      // Guardar resultados enriquecidos en el request
      req.processedFiles = enrichedFiles;
      req.processedFilesRoutes = enrichedFiles.map((f) => f.routePath);
      
      // Para múltiples archivos, guardar todos los route_parameter_values en un array
      req.routeParameterValues = enrichedFiles.map(f => f.routeParameterValues);
    } else {
      // Archivo único
      const singleFileValues = {
        ...baseValues,
      };

      // Construir ruta para archivo único
      const { routePath, routeParameterValues } = buildRoutePathWithParameters(routeParameters, singleFileValues);

      req.routePath = routePath;
      req.routeRuleId = routeParameters[0].route_rule_id;
      req.routeParameterValues = routeParameterValues; // Agregar valores de parámetros para archivo único
    }

    // Datos comunes para ambos casos
    req.channelId = channelExists.id;
    req.documentTypeId = documentTypeExists.id;
    req.securityLevelId = securityLevel.id;

    next();
  } catch (error) {
    return res.status(500).json({
      error: "Error al procesar las reglas de ruta",
      details: error.message,
    });
  }
};

// Construye la ruta basada en los parámetros de ruta y valores específicos
// Ahora también retorna los route_parameter_values
const buildRoutePathWithParameters = (routeParameters, values) => {
  const separator = routeParameters[0].separator_char || "/";
  const routeParts = [];
  const dynamicValues = {};
  const routeParameterValues = [];

  // Ordenar parámetros por position_order para asegurar el orden correcto
  const sortedParameters = routeParameters.sort((a, b) => a.position_order - b.position_order);

  // Pre-calcular valores dinámicos
  for (const param of sortedParameters) {
    if (!param.default_value || param.default_value === "") {
      dynamicValues[param.parameter_key] = getParameterValue(
        param.parameter_key,
        values
      );
    }
  }

  // Construir partes de la ruta y crear route_parameter_values
  for (const param of sortedParameters) {
    let paramValue = null;

    if (param.default_value !== null && param.default_value !== "") {
      paramValue = param.default_value;
    } else {
      paramValue = dynamicValues[param.parameter_key];
    }

    if (param.is_required && !paramValue) {
      throw new Error(
        `El parámetro requerido '${param.name}' (${param.parameter_key}) no tiene valor ${values.fileIndex !== undefined ? `para el archivo con índice ${values.fileIndex}` : ''}`
      );
    }

    if (paramValue) {
      routeParts.push(paramValue);
    }

    // Agregar al array de route_parameter_values (incluso si paramValue es vacío)
    routeParameterValues.push({
      route_parameter_id: parseInt(param.route_parameter_id),
      position_order: param.position_order,
      value: paramValue || '' // Si no hay valor, usar string vacío
    });
  }

  return {
    routePath: routeParts.join(separator),
    routeParameterValues
  };
};

// Mantener la función original por compatibilidad (si se usa en otros lugares)
const buildRoutePath = (routeParameters, values) => {
  const { routePath } = buildRoutePathWithParameters(routeParameters, values);
  return routePath;
};