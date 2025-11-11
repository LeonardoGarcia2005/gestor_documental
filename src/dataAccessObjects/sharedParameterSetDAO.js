import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const createOrGetSharedParameterSet = async (pathTemplateId, parameterHash, parameterJson, computedRoute = null) => {
  try {
    // Buscar si ya existe el conjunto de parámetros
    const querySelect = `
      SELECT id
      FROM shared_parameter_set
      WHERE parameter_hash = $1
        AND status = TRUE
      LIMIT 1;
    `;
    const existing = await dbConnectionProvider.firstOrDefault(querySelect, [parameterHash]);

    if (existing) {
      // Actualizar referencia
      const queryUpdateRef = `
        UPDATE shared_parameter_set
        SET reference_count = reference_count + 1,
            last_used_at = NOW()
        WHERE id = $1;
      `;
      await dbConnectionProvider.execute(queryUpdateRef, [existing.id]);

      return existing.id;
    }

    // Crear un nuevo conjunto de parámetros
    const queryInsert = `
      INSERT INTO shared_parameter_set 
        (path_template_id, parameter_hash, parameter_json, computed_route, reference_count, created_at, updated_at, status)
      VALUES ($1, $2, $3::jsonb, $4, 1, NOW(), NOW(), TRUE)
      RETURNING id;
    `;

    const values = [pathTemplateId, parameterHash, JSON.stringify(parameterJson), computedRoute];
    const newRecord = await dbConnectionProvider.firstOrDefault(queryInsert, values);

    return newRecord.id;
  } catch (err) {
    loggerGlobal.error(`Error al crear o buscar shared_parameter_set`, err);
    throw new Error("Error al crear o buscar shared_parameter_set");
  }
};

const sharedParameterSetDAO = {
  createOrGetSharedParameterSet,
};

export { sharedParameterSetDAO };
