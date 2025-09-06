import { dbConnectionProvider } from "../db/dbConnectionManager.js";
import { FabricaErrores } from "../errors/errorsManager.js";
import { loggerGlobal } from "../../globalServices/logging/loggerManager.js";

const getCanalById = async (id) => {
  try {
    const values = [id];
    const query = `SELECT       id,nombre,estado,fecha_creacion,fecha_desactivacion
                        FROM        canal_carga
                        WHERE       id =${id}`;

    const respuesta = await dbConnectionProvider.oneOrNone(query, values);
    loggerGlobal.debug("Respuesta en el metodo consultaCanal de canalDAO: ");
    loggerGlobal.debug(respuesta);
    return respuesta;
  } catch (errorConsulta) {
    if (
      errorConsulta instanceof dbConnectionProvider.pgpErrors.QueryResultError
    ) {
      if (
        errorConsulta.code ===
        dbConnectionProvider.pgpErrors.queryResultErrorCode.noData
      ) {
        throw FabricaErrores.crearError(
          FabricaErrores.TipoError.ErrorDatosNoEncontrados,
          "No se encontro el canal con Id " + id,
          errorConsulta
        );
      }
    }
    throw errorConsulta;
  }
};

const getChannelByName = async (name) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryChannel = `
            SELECT * 
                FROM channel 
                WHERE status = TRUE
                AND name ILIKE $1;
            `;

    const values = [name];

    // Ejecución de la consulta
    const resultChannel = await dbConnectionProvider.firstOrDefault(
      queryChannel,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultChannel;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el canal`, err);
    throw new Error("Error al obtener el canal");
  }
};

const channelDAO = {
  getCanalById: getCanalById,
  getChannelByName: getChannelByName,
};

export { channelDAO };
