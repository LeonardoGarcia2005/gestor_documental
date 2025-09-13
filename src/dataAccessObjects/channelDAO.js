import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const existsChannel = async (channel) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryChannel = `
        SELECT EXISTS (
          SELECT 1
          FROM channel
          WHERE status = TRUE
          AND name = $1
        );
    `;

    const values = [channel];

    // Ejecución de la consulta
    const resultChannel = await dbConnectionProvider.firstOrDefault(
      queryChannel,
      values
    );

    // Retornar true o false
    return resultChannel;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el canal`, err);
    throw new Error("Error al obtener el canal");
  }
};

const channelDAO = {
  existsChannel: existsChannel,
};

export { channelDAO };
