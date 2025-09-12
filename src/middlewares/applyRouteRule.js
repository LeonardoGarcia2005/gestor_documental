import { routeRuleDAO } from "../dataAccessObjects/routeRuleDAO.js";

export const applyRouteRule = async (req, res, next) => {
  try {
    const { securityContext } = req;

    if (!securityContext) {
      return res.status(500).json({
        error: "Contexto de seguridad no establecido",
      });
    }

    const { securityLevel, hasCompany } = securityContext;
    const securityLevelParsed = securityLevel.toLowerCase();

    // Consultar la base de datos para determinar qué plantilla de ruta le toca
    const routePath = await routeRuleDAO.getRouteRuleBySecurityAndCompany(
      securityLevelParsed,
      hasCompany
    );

    if (!routePath) {
      return res.status(404).json({
        error: "No se encontró plantilla de ruta para el caso especificado",
        details: { securityLevel: securityLevelParsed, hasCompany },
      });
    }

    // Agregar información de ruta al request
    req.routePath = routePath;

    next();
  } catch (error) {
    return res.status(500).json({
      error: "Error determinando regla de ruta",
      details: error.message,
    });
  }
};

