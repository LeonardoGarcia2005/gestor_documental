import { routeRuleDAO } from "../dataAccessObjects/routeRuleDAO.js";
import { channelDAO } from "../dataAccessObjects/channelDAO.js";
import { documentTypeDAO } from "../dataAccessObjects/documentTypeDAO.js";
import { getParameterValue } from "../lib/routeParameterMappings.js";

export const applyRouteRule = async (req, res, next) => {
  try {
    const rawValues = req.body;
    const { securityContext } = req;

    if (!securityContext) {
      return res.status(500).json({
        error: "Contexto de seguridad no establecido",
      });
    }

    // Ingresar el valor del codigo de la empresa solo si existe
    const finalValues = {
      ...rawValues,
      ...(securityContext.companyCode
        ? { companyCode: securityContext.companyCode }
        : {}),
    };

    // Realizar las consultas en conjunto para optimizar el middleware
    const [channelExists, documentTypeExists, routeParameters] =
      await Promise.all([
        channelDAO.existsChannel(finalValues.channel),
        documentTypeDAO.existDocumentType(finalValues.documentType),
        routeRuleDAO.getRouteRuleBySecurityAndCompany(finalValues),
      ]);

    if (!channelExists) {
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
        error: `No se encontró una regla de ruta para securityLevel: ${finalValues.securityLevel}, hasCompany: ${finalValues.hasCompany}`,
      });
    }

    // Construcción de la ruta
    const separator = routeParameters[0].separator_char || "/";
    const routeParts = [];
    const dynamicValues = {};

    // Pre-calcular dinámicos
    for (const param of routeParameters) {
      if (!param.default_value || param.default_value === "") {
        dynamicValues[param.parameter_key] = getParameterValue(
          param.parameter_key,
          finalValues
        );
      }
    }

    for (const param of routeParameters) {
      let paramValue = null;

      if (param.default_value !== null && param.default_value !== "") {
        paramValue = param.default_value;
      } else {
        paramValue = dynamicValues[param.parameter_key];
      }

      if (param.is_required && !paramValue) {
        throw new Error(
          `El parámetro requerido '${param.name}' (${param.parameter_key}) no tiene valor`
        );
      }

      if (paramValue) {
        routeParts.push(paramValue);
      }
    }

    // Guardar en el request
    req.routePath = routeParts.join(separator);

    next();
  } catch (error) {
    return res.status(500).json({
      error: "No se encontró plantilla de ruta para el caso especificado",
      details: error.message,
    });
  }
};
