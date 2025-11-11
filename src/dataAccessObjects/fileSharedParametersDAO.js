import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const linkFileWithSharedParameters = async (fileId, fileVariantId, sharedParameterSetId) => {
  try {
    const query = `
      INSERT INTO file_shared_parameters 
        (file_id, file_variant_id, shared_parameter_set_id, created_at, status)
      VALUES ($1, $2, $3, NOW(), TRUE)
      RETURNING id;
    `;

    const values = [fileId, fileVariantId, sharedParameterSetId];
    const result = await dbConnectionProvider.firstOrDefault(query, values);

    return result.id;
  } catch (err) {
    loggerGlobal.error(`Error al vincular archivo con parámetros compartidos`, err);
    throw new Error("Error al vincular archivo con parámetros compartidos");
  }
};

const fileSharedParametersDAO = {
  linkFileWithSharedParameters,
};

export { fileSharedParametersDAO };
