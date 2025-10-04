import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { filesDAO } from "./filesDAO.js";

// Insertar los parámetros del archivo (filtrando los que tienen default)
const insertFileParameterValue = async (fileId, routeRuleId, routeParameterValues, t) => {
    try {
        if (!fileId || !routeRuleId) {
            throw new Error('fileId y routeRuleId son requeridos');
        }

        if (!Array.isArray(routeParameterValues) || routeParameterValues.length === 0) {
            loggerGlobal.info(
                `No hay parámetros para procesar en file_id: ${fileId}`
            );
            return [];
        }

        const ruleParamsQuery = `
            SELECT 
                rrp.route_parameter_id,
                rrp.default_value,
                rrp.is_dynamic,
                rrp.is_required,
                rp.parameter_key,
                rp.name
            FROM route_rule_parameter rrp
            JOIN route_parameter rp ON rrp.route_parameter_id = rp.id
            WHERE rrp.route_rule_id = $1 
              AND rrp.status = TRUE
              AND rp.status = TRUE
            ORDER BY rrp.position_order ASC
        `;

        const ruleParams = await dbConnectionProvider.getAll(
            ruleParamsQuery,
            [routeRuleId]
        );

        if (!ruleParams || ruleParams.length === 0) {
            throw new Error(
                `No se encontraron parámetros para route_rule_id: ${routeRuleId}`
            );
        }

        const dynamicParams = [];
        const skippedStatic = [];

        for (const routeParam of routeParameterValues) {
            // Buscar la configuración de este parámetro
            const paramConfig = ruleParams.find(
                rp => rp.route_parameter_id == routeParam.route_parameter_id
            );

            if (!paramConfig) {
                loggerGlobal.warn(
                    `Parámetro ${routeParam.route_parameter_id} no encontrado en regla ${routeRuleId}`
                );
                continue;
            }

            // SOLO guardar si es dinámico (is_dynamic = TRUE)
            if (paramConfig.is_dynamic) {
                dynamicParams.push({
                    ...routeParam,
                    parameterName: paramConfig.name,
                    parameterKey: paramConfig.parameter_key,
                    isRequired: paramConfig.is_required
                });
            } else {
                // Este parámetro tiene default, no lo guardamos
                skippedStatic.push({
                    name: paramConfig.name,
                    defaultValue: paramConfig.default_value
                });
            }
        }

        loggerGlobal.debug({
            fileId,
            routeRuleId,
            summary: {
                total: routeParameterValues.length,
                dynamic: dynamicParams.length,
                static: skippedStatic.length
            }
        });

        if (dynamicParams.length === 0) {
            loggerGlobal.info(
                `No hay parámetros dinámicos para guardar en file_id: ${fileId} ` +
                `(${skippedStatic.length} usan defaults)`
            );
            return [];
        }

        const now = new Date();
        const valuesToInsert = dynamicParams.map((routeParam) => {
            // Validar parámetros requeridos
            if (routeParam.isRequired &&
                (routeParam.value === null ||
                    routeParam.value === undefined ||
                    routeParam.value === '')) {
                throw new Error(
                    `El parámetro requerido '${routeParam.parameterName}' ` +
                    `(${routeParam.parameterKey}) no puede estar vacío`
                );
            }

            return {
                file_id: fileId,
                route_parameter_id: routeParam.route_parameter_id,
                parameter_value: routeParam.value,
                creation_date: now,
                status: true,
            };
        });

        const resultFileParameterValue = await dbConnectionProvider.insertRange(
            "file_parameter_value",
            valuesToInsert,
            t
        );

        loggerGlobal.info({
            message: 'Parámetros dinámicos insertados exitosamente',
            fileId,
            routeRuleId,
            inserted: valuesToInsert.length,
            skipped: skippedStatic.length,
            parameters: dynamicParams.map(p => ({
                name: p.parameterName,
                value: p.value
            }))
        });

        return resultFileParameterValue;

    } catch (err) {
        loggerGlobal.error({
            message: 'Error al insertar parámetros del archivo',
            fileId,
            routeRuleId,
            error: err.message,
            stack: err.stack
        });

        throw new Error(
            `Error al insertar parámetros del archivo (file_id: ${fileId}): ${err.message}`
        );
    }
};

const buildFilePathFromCode = async (codeFile) => {
    try {
        const fileData = await filesDAO.getFileByCode(codeFile);

        if (!fileData) {
            throw new Error(`No se encontró el archivo con código: ${codeFile}`);
        }
        // Obtener los parametros de las reglas predefinidas y que ya estan por defectos
        const routeParamsQuery = `
            SELECT 
                rrp.route_parameter_id,
                rrp.default_value,
                rrp.position_order,
                rr.separator_char
            FROM route_rule_parameter rrp
            JOIN route_rule rr ON rrp.route_rule_id = rr.id
            WHERE rrp.route_rule_id = $1 
              AND rrp.status = TRUE
            ORDER BY rrp.position_order ASC
        `;

        const routeParams = await dbConnectionProvider.getAll(
            routeParamsQuery,
            [fileData.route_rule_id]
        );

        if (!routeParams || routeParams.length === 0) {
            throw new Error(`No se encontraron parámetros de ruta para route_rule_id: ${fileData.route_rule_id}`);
        }

        const separatorChar = routeParams[0].separator_char || path.sep;

        // Obtener los valores dinamicos guardados
        const dynamicValuesQuery = `
            SELECT 
                fpv.route_parameter_id,
                fpv.parameter_value
            FROM file_parameter_value fpv
            WHERE fpv.file_id = $1 AND fpv.status = TRUE
        `;

        const dynamicValues = await dbConnectionProvider.getAll(
            dynamicValuesQuery,
            [fileData.id]
        );

        // Construir la ruta combinando default y dinamicos
        const routeParts = [];

        for (const param of routeParams) {
            // Buscar si existe un valor dinámico para este parámetro
            const dynamicParam = dynamicValues.find(
                dv => dv.route_parameter_id == param.route_parameter_id
            );

            // Prioridad: valor dinámico > default
            const effectiveValue = dynamicParam
                ? dynamicParam.parameter_value
                : param.default_value;

            // Solo agregar valores válidos a la ruta
            if (effectiveValue && effectiveValue !== '') {
                routeParts.push(effectiveValue);
            }
        }

        const relativePath = routeParts.join(separatorChar);
        // Se añade la ruta construida y a su vez el nombre del archivo
        const fullRoutePath = `${relativePath}/${fileData.file_name}`;

        return fullRoutePath;

    } catch (err) {
        loggerGlobal.error(`Error al construir ruta para archivo ${codeFile}:`, err);
        throw new Error(`Error al construir ruta del archivo: ${err.message}`);
    }
};

const fileParameterValueDAO = {
    insertFileParameterValue,
    buildFilePathFromCode
};

export { fileParameterValueDAO };