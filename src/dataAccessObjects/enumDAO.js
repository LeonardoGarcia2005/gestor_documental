import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

// Función para traer los valores del enum
const getEnumValues = async (enumName) => {
  const query = `
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = $1
  `;

  // getAll devuelve directamente un array de objetos
  const result = await dbConnectionProvider.getAll(query, [enumName]);

  return result.map(r => r.enumlabel);
};

export const channels = await getEnumValues("channel_enum");
export const documentTypes = await getEnumValues("document_type_enum");
export const securityLevels = await getEnumValues("security_level_enum");
export const fileExtensions = await getEnumValues("file_extension_enum");
export const deviceTypes = await getEnumValues("device_type_enum");
export const fileTypes = await getEnumValues("file_types_enum");


