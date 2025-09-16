import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const existsChannel = async (channel) => {
  try {
    const queryChannel = `
      SELECT id, TRUE as exists
      FROM channel
      WHERE status = TRUE
      AND name = $1
      LIMIT 1;
    `;

    const values = [channel];

    const resultChannel = await dbConnectionProvider.firstOrDefault(
      queryChannel,
      values
    );

    // Si no encuentra nada, devolvemos false y null
    if (!resultChannel) {
      return { exists: false, id: null };
    }

    return { exists: true, id: resultChannel.id };
  } catch (err) {
    loggerGlobal.error(`Error al obtener el canal`, err);
    throw new Error("Error al obtener el canal");
  }
};

const channelDAO = {
  existsChannel: existsChannel,
};

export { channelDAO };
