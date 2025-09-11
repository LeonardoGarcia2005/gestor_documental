export const applyRouteRule = async (req, res, next) => {
  try {
    const { securityContext } = req;
    
    if (!securityContext) {
      return res.status(500).json({
        error: 'Contexto de seguridad no establecido'
      });
    }

    const { hasCompany, securityLevel } = securityContext;
    const isPublic = securityLevel === 'public';

    // Determinar ID de regla de ruta basado en la matriz de casos
    let routeRuleId;
    
    if (isPublic && hasCompany) {
      routeRuleId = 1; // Públicos Con Empresa
    } else if (isPublic && !hasCompany) {
      routeRuleId = 2; // Públicos Sin Empresa  
    } else if (!isPublic && hasCompany) {
      routeRuleId = 3; // Privados Con Empresa
    } else if (!isPublic && !hasCompany) {
      routeRuleId = 4; // Privados Sin Empresa
    }

    // Agregar información de ruta al request
    req.routeRuleId = routeRuleId;
    
    // Log para debugging (opcional)
    console.log(`Aplicando regla de ruta ${routeRuleId}: ${securityLevel} ${hasCompany ? 'con' : 'sin'} empresa`);

    next();
    
  } catch (error) {
    return res.status(500).json({
      error: 'Error determinando regla de ruta',
      details: error.message
    });
  }
};