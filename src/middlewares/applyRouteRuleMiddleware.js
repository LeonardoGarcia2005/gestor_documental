import { routeRuleDAO } from "../dataAccessObjects/routeRuleDAO.js";
import { channelDAO } from "../dataAccessObjects/channelDAO.js";
import { documentTypeDAO } from "../dataAccessObjects/documentTypeDAO.js";
import { getParameterValue } from "../lib/routeParameterMappings.js";
import { securityLevelDAO } from "../dataAccessObjects/securityLevelDAO.js";

export const applyRouteRule = async (req, res, next) => {
  try {
    const rawValues = req.body;
    const { securityContext, isForMultiFile, isDistinctFiles } = req;
    const httpMethod = req.method;

    if (!securityContext) {
      return res.status(500).json({
        error: "Contexto de seguridad no establecido",
      });
    }

    // Validamos que si tiene empresa en true y si es publico le colocamos el valor static
    if (rawValues.hasCompany && securityContext.securityLevel === "public") {
      rawValues.storage = "static";
    }

    // Valores base compartidos
    const baseValues = {
      ...rawValues,
      isForMultiFile,
      ...(securityContext.companyCode
        ? { companyCode: securityContext.companyCode }
        : {}),
    };

    // Realizar las consultas comunes una sola vez
    const [channelExists, documentTypeExists, securityLevel] =
      await Promise.all([
        channelDAO.existsChannel(baseValues.channel),
        documentTypeDAO.existDocumentType(baseValues.documentType),
        securityLevelDAO.getSecurityByType(baseValues.securityLevel),
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

    // Distinct files procesa cada archivo individualmente
    if (isDistinctFiles) {
      const originalProcessed = Array.isArray(req.processedFiles)
        ? req.processedFiles
        : [];

      const enrichedFiles = [];

      // Procesar cada archivo con su propia regla de ruta
      for (let i = 0; i < req.body.filesData.length; i++) {
        const fileData = req.body.filesData[i];
        const original = originalProcessed[i] || {};

        // Valores específicos para este archivo (cada uno puede tener deviceType diferente)
        const fileSpecificValues = {
          ...baseValues,
          fileIndex: i,
          deviceType: fileData.deviceType,
          ...(original.resolution ? { resolution: original.resolution } : {}),
        };

        // Obtener regla de ruta específica para este archivo
        const routeParameters = await routeRuleDAO.getRouteRuleComplete(
          fileSpecificValues,
          httpMethod
        );

        if (!routeParameters || routeParameters.length === 0) {
          return res.status(500).json({
            error: `No se encontró una regla de ruta para el archivo ${i + 1} (deviceType: ${fileData.deviceType})`,
          });
        }

        // Construir ruta específica para este archivo
        const { routePath, routeParameterValues } = buildRoutePathWithParameters(
          routeParameters,
          fileSpecificValues
        );

        enrichedFiles.push({
          ...original,
          fileIndex: i,
          routePath,
          routeRuleId: routeParameters[0].route_rule_id,
          originalFile: fileData.file,
          routeParameterValues,
          ...(original.resolution
            ? { dimensions: { resolution: original.resolution } }
            : {}),
        });
      }

      // Guardar resultados enriquecidos
      req.processedFiles = enrichedFiles;
      req.processedFilesRoutes = enrichedFiles.map((f) => f.routePath);
      req.routeParameterValues = enrichedFiles.map(f => f.routeParameterValues);
    }
    // Archivos múltiples con la MISMA ruta (mismo deviceType)
    else if (isForMultiFile) {
      // Obtener regla de ruta UNA SOLA VEZ (todos comparten la misma)
      const routeParameters = await routeRuleDAO.getRouteRuleComplete(
        baseValues,
        httpMethod
      );

      if (!routeParameters || routeParameters.length === 0) {
        return res.status(500).json({
          error: `No se encontró una regla de ruta para securityLevel: ${baseValues.securityLevel}, hasCompany: ${baseValues.hasCompany}`,
        });
      }

      const originalProcessed = Array.isArray(req.processedFiles)
        ? req.processedFiles
        : [];

      // Construir ruta UNA SOLA VEZ
      const { routePath, routeParameterValues } = buildRoutePathWithParameters(
        routeParameters,
        baseValues
      );

      // Aplicar la misma ruta a todos los archivos
      const enrichedFiles = req.body.filesData.map((fileData, i) => {
        const original = originalProcessed[i] || {};

        return {
          ...original,
          fileIndex: i,
          deviceType: fileData.deviceType,
          routePath,
          routeRuleId: routeParameters[0].route_rule_id,
          originalFile: fileData.file,
          routeParameterValues,
          ...(original.resolution
            ? { dimensions: { resolution: original.resolution } }
            : {}),
        };
      });

      req.processedFiles = enrichedFiles;
      req.processedFilesRoutes = enrichedFiles.map((f) => f.routePath);
      req.routeParameterValues = enrichedFiles.map(f => f.routeParameterValues);
    }
    // Archivo único
    else {
      const routeParameters = await routeRuleDAO.getRouteRuleComplete(
        baseValues,
        httpMethod
      );

      if (!routeParameters || routeParameters.length === 0) {
        return res.status(500).json({
          error: `No se encontró una regla de ruta para securityLevel: ${baseValues.securityLevel}, hasCompany: ${baseValues.hasCompany}`,
        });
      }

      const { routePath, routeParameterValues } = buildRoutePathWithParameters(
        routeParameters,
        baseValues
      );

      req.routePath = routePath;
      req.routeRuleId = routeParameters[0].route_rule_id;
      req.routeParameterValues = routeParameterValues;
    }

    // Datos comunes para todos los casos
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

export const buildRoutePathWithParameters = (routeParameters, values) => {
  const separator = routeParameters[0].separator_char || "/";
  const routeParts = [];
  const dynamicValues = {};
  const routeParameterValues = [];

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

  // Construir partes de la ruta
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

    routeParameterValues.push({
      route_parameter_id: parseInt(param.route_parameter_id),
      position_order: param.position_order,
      value: paramValue || ''
    });
  }

  return {
    routePath: routeParts.join(separator),
    routeParameterValues
  };
};