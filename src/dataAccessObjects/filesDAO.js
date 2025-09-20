import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getFileByMd5AndRouteRuleId = async (md5, routeRuleId) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryFile = `
            SELECT 
            file_name AS "fileName", 
            code AS "codeFile", 
            dt.name AS "documentType", 
            document_emission_date AS "emissionDate", 
            document_expiration_date AS "expirationDate",
            sl.type AS "securityLevel"
            FROM file AS f
            JOIN document_type dt ON f.document_type_id = dt.id
            JOIN security_level sl ON f.security_level_id = sl.id
            WHERE f.route_rule_id = $1 AND f.file_hash_md5 = $2 AND f.status = TRUE
        `;

    const values = [routeRuleId, md5];

    // Ejecución de la consulta
    const resultFile = await dbConnectionProvider.firstOrDefault(
      queryFile,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultFile;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el archivo`, err);
    throw new Error("Error al obtener el archivo, intenta nuevamente");
  }
};

const insertFile = async (
  companyId,
  documentTypeId,
  channelId,
  securityLevelId,
  extensionId,
  codeFile,
  isUsed,
  routeRuleId,
  fileName,
  documentEmissionDate,
  documentExpirationDate,
  hasVariants,
  sizeBytes,
  fileHashMd5,
  t
) => {
  try {
    // Validar que si no viene la fecha de emision ni de expiracion colocar unas por defecto
    const formatDate = (date) => date.toISOString().split("T")[0]; // Formatear la fecha a YYYY-MM-DD

    if (!documentEmissionDate) {
      documentEmissionDate = formatDate(new Date());
    }

    if (!documentExpirationDate) {
      const expiration = new Date();
      expiration.setFullYear(expiration.getFullYear() + 1);
      documentExpirationDate = formatDate(expiration);
    }

    // Construcción del objeto con los valores para la inserción
    const values = {
      company_id: companyId,
      document_type_id: documentTypeId,
      channel_id: channelId,
      security_level_id: securityLevelId,
      extension_id: extensionId,
      code: codeFile,
      is_used: isUsed,
      route_rule_id: routeRuleId,
      file_name: fileName,
      has_variants: hasVariants,
      size_bytes: sizeBytes,
      file_hash_md5: fileHashMd5,
      document_emission_date: documentEmissionDate,
      document_expiration_date: documentExpirationDate,
      creation_date: new Date(),
      modification_date: null,
      deactivation_date: null,
      status: true,
    };

    // Validar que todos los campos requeridos estén presentes
    const requiredFields = [
      "document_type_id",
      "channel_id",
      "security_level_id",
      "extension_id",
      "code",
      "route_rule_id",
      "file_name",
      "size_bytes",
      "file_hash_md5",
    ];

    for (const field of requiredFields) {
      if (values[field] === null || values[field] === undefined) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Ejecución de la consulta de inserción
    const result = await dbConnectionProvider.insertOne("file", values, t);

    return result;
  } catch (error) {
    loggerGlobal.error("Error al insertar archivo en base de datos", {
      error: error.message,
      stack: error.stack,
      codeFile,
      fileName,
    });
    throw new Error(`Error al insertar archivo: ${error.message}`);
  }
};

const filesDAO = {
  getFileByMd5AndRouteRuleId,
  insertFile,
};

export { filesDAO };
