import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getRouteRuleBySecurityAndCompany = async (securityLevel, hasCompany, dynamicParams = {}) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryParameters = `
      SELECT 
        rp.parameter_key,
        rp.name,
        rrp.default_value,
        rrp.position_order,
        rrp.is_required,
        rr.separator_char
      FROM route_rule_parameter rrp
      JOIN route_parameter rp ON rrp.route_parameter_id = rp.id
      JOIN route_rule rr ON rrp.route_rule_id = rr.id
      WHERE rr.security_level_type = $1 
        AND rr.company_required = $2
        AND rr.is_template_for_insertion = TRUE
        AND rr.status = TRUE
        AND rrp.status = TRUE
        AND rp.status = TRUE
      ORDER BY rrp.position_order
    `;

    const values = [securityLevel, hasCompany];

    // para obtener TODOS los parámetros de la regla encontrada
    const routeParameters = await dbConnectionProvider.getAll(
      queryParameters,
      values
    );

    // Validar que se obtuvieron resultados
    if (!routeParameters || routeParameters.length === 0) {
      throw new Error(`No se encontró una regla de ruta para securityLevel: ${securityLevel}, hasCompany: ${hasCompany}`);
    }

    // Obtener el separador (es el mismo para todos los parámetros de la regla)
    const separator = routeParameters[0].separator_char || "/";

    // Construir la ruta paso a paso con TODOS los parámetros
    let routePath = "";

    for (const param of routeParameters) {
      let paramValue = null;

      // Determinar el valor del parámetro
      if (dynamicParams[param.parameter_key]) {
        // Si se proporciona dinámicamente
        paramValue = dynamicParams[param.parameter_key];
      } else if (param.default_value) {
        // Si tiene valor por defecto
        paramValue = param.default_value;
      }

      // Validar parámetros requeridos
      if (param.is_required && !paramValue) {
        throw new Error(
          `El parámetro requerido '${param.name}' (${param.parameter_key}) no tiene valor`
        );
      }

      // Agregar al path si tiene valor
      if (paramValue) {
        // Para el primer parámetro (position_order = 1), no agregar separador inicial
        if (param.position_order === 1) {
          routePath = paramValue;
        } else {
          routePath += separator + paramValue;
        }
      }
    }

    return {
      success: true,
      routePath: routePath,
      separator: separator,
      parametersCount: routeParameters.length
    };

  } catch (err) {
    loggerGlobal.error(`Error al construir la ruta`, err);
    throw new Error(`Error al construir la ruta: ${err.message}`);
  }
};

const routeRuleDAO = {
  getRouteRuleBySecurityAndCompany,
};

export { routeRuleDAO };