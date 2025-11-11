import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const getDeviceTypeByResolution = async (deviceType, resolution) => {
  try {
    // La resolución debe ser enviada como "1920x1080"
    const [width, height] = resolution.split("x").map(Number);

    const queryDeviceType = `
      SELECT id, TRUE as exists
      FROM device_type_by_resolution
      WHERE status = TRUE
        AND device_type = $1
        AND $2 BETWEEN min_width AND max_width
        AND $3 BETWEEN min_height AND max_height
      LIMIT 1;
    `;

    const values = [deviceType, width, height];

    const resultDeviceType = await dbConnectionProvider.firstOrDefault(
      queryDeviceType,
      values
    );

    if (!resultDeviceType) {
      return { exists: false, id: null };
    }

    return { exists: true, id: resultDeviceType.id };
  } catch (err) {
    loggerGlobal.error(`Error al obtener el tipo de resolución`, err);
    throw new Error("Error al obtener el tipo de resolución");
  }
};

const deviceTypeByResolutionDAO = {
  getDeviceTypeByResolution,
};

export { deviceTypeByResolutionDAO };
