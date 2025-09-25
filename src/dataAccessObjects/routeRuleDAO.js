import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getRouteRuleBySecurityAndCompany = async (finalValues) => {
  try {

    const queryParameters = `
      SELECT
        rr.id as route_rule_id,
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
        AND rr.is_multi_file = $3
        AND rr.status = TRUE
        AND rrp.status = TRUE
        AND rp.status = TRUE
      ORDER BY rrp.position_order
    `;

    const values = [finalValues.securityLevel, finalValues.hasCompany, finalValues.hasManyFiles];
    const routeParameters = await dbConnectionProvider.getAll(queryParameters, values);

    if (!routeParameters || routeParameters.length === 0) {
      throw new Error(`No se encontró una regla de ruta para securityLevel: ${finalValues.securityLevel}, hasCompany: ${finalValues.hasCompany}, hasManyFile: ${finalValues.hasManyFiles}`);
    }

    return routeParameters
  } catch (err) {
    loggerGlobal.error(`Error al construir la ruta`, err);
    throw new Error(`Error al construir la ruta: ${err.message}`);
  }
};

const routeRuleDAO = {
  getRouteRuleBySecurityAndCompany
};

export { routeRuleDAO };