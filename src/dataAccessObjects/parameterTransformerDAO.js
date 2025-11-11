import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const getAllTransformers = async () => {
  try {
    const query = `
      SELECT 
        id,
        parameter_key,
        context_property,
        default_value,
        is_dynamic,
        status
      FROM parameter_transformer
      WHERE status = true
      ORDER BY id
    `;
    const resultTransformers = await dbConnectionProvider.getAll(query);

    if (!resultTransformers) {
      return [];
    }

    return resultTransformers;
  } catch (err) {
    loggerGlobal.error(`Error al obtener los transformadores de parámetros`, err);
    throw new Error("Error al obtener los transformadores de parámetros");
  }
};

const parameterTransformerDAO = {
  getAllTransformers,
};

export { parameterTransformerDAO };
