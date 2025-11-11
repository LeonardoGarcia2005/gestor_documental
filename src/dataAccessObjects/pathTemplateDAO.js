import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const getTemplateByConditions = async (conditions) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        description,
        template,
        match_conditions,
        status
      FROM path_template
      WHERE status = TRUE
        AND match_conditions = $1::jsonb
      LIMIT 1;
    `;

    const values = [JSON.stringify(conditions)];

    const resultTemplate = await dbConnectionProvider.firstOrDefault(query, values);

    if (!resultTemplate) {
      return { exists: false, template: null };
    }

    return { exists: true, template: resultTemplate };
  } catch (err) {
    loggerGlobal.error(`Error al obtener el template de ruta`, err);
    throw new Error("Error al obtener el template de ruta");
  }
};

const pathTemplateDAO = {
  getTemplateByConditions,
};

export { pathTemplateDAO };
