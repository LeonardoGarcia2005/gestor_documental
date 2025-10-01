import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

// Insertar los parametros del archivo
const insertFileParameterValue = async (fileId, routeParameterValues, t) => {
    try {
        const values = routeParameterValues.map((routeParameterValue) => {
            return {
                file_id: fileId,
                route_parameter_id: routeParameterValue.route_parameter_id,
                parameter_value: routeParameterValue.value,
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

        // Retornar resultado o null si no se encuentra
        return resultFileParameterValue;
    } catch (err) {
        loggerGlobal.error(`Error al insertar los parametros del archivo`, err);
        throw new Error("Error al insertar los parametros del archivo, intenta nuevamente");
    }
};


const fileParameterValueDAO = {
    insertFileParameterValue,
};

export { fileParameterValueDAO };
