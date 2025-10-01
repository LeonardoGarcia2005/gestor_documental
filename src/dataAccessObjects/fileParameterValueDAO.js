import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

// Insertar los parámetros del archivo (filtrando los que tienen default)
const insertFileParameterValue = async (fileId, routeRuleId, routeParameterValues, t) => {
    try {
        // Obtener la configuración de defaults de la regla
        const ruleParamsQuery = `
            SELECT 
                rrp.route_parameter_id,
                rrp.default_value
            FROM route_rule_parameter rrp
            WHERE rrp.route_rule_id = $1 AND rrp.status = TRUE
        `;

        const ruleParams = await dbConnectionProvider.getAll(ruleParamsQuery, [routeRuleId]);

        // Crear un mapa de defaults para acceso rápido
        const defaultsMap = new Map(
            ruleParams.map(param => [param.route_parameter_id, param.default_value])
        );

        // Filtrar: solo guardar si NO tiene default o si el valor difiere del default
        const filteredValues = routeParameterValues.filter((routeParam) => {
            const defaultValue = defaultsMap.get(routeParam.route_parameter_id);
            
            // Guardar si:
            // 1. No existe default (es un parámetro dinámico), O
            // 2. El valor es diferente al default (es un override)
            return !defaultValue || routeParam.value !== defaultValue;
        });

        // Si no hay valores para insertar después del filtrado
        if (filteredValues.length === 0) {
            loggerGlobal.info(
                `No hay parámetros dinámicos para guardar en file_id: ${fileId} (todos usan defaults)`
            );
            return [];
        }

        // Mapear al formato de inserción incluyendo position_order
        const values = filteredValues.map((routeParameterValue) => {
            return {
                file_id: fileId,
                route_parameter_id: routeParameterValue.route_parameter_id,
                parameter_value: routeParameterValue.value,
                position_order: routeParameterValue.position_order, // ← Guardar el orden
                creation_date: new Date(),
                status: true,
            };
        });

        // Ejecución de la consulta
        const resultFileParameterValue = await dbConnectionProvider.insertRange(
            "file_parameter_value",
            values,
            t
        );

        loggerGlobal.info(
            `Insertados ${values.length} de ${routeParameterValues.length} parámetros para file_id: ${fileId}`
        );

        // Retornar resultado
        return resultFileParameterValue;
    } catch (err) {
        loggerGlobal.error(`Error al insertar los parámetros del archivo`, err);
        throw new Error("Error al insertar los parámetros del archivo, intenta nuevamente");
    }
};

const fileParameterValueDAO = {
    insertFileParameterValue,
};

export { fileParameterValueDAO };