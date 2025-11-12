import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getCompanyByCode = async (companyCode) => {
  if (!companyCode || typeof companyCode !== "string") {
    throw new Error("El parámetro 'companyCode' es inválido.");
  }

  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryCompany = `
            SELECT 
              id,
              company_code  
            FROM company 
            WHERE status = TRUE AND company_code = $1
        `;
    const values = [companyCode];

    // Ejecución de la consulta
    const resultCompany = await dbConnectionProvider.firstOrDefault(
      queryCompany,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultCompany;
  } catch (err) {
    loggerGlobal.error(
      `Ocurrio un error a la hora de obtener la empresa por el codigo, servicio ("getCompanyByCode")`,
      err
    );
    throw new Error(
      "Error al obtener la información de la empresa. Intente nuevamente."
    );
  }
};

const getCompanyByName = async (name) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryCompany = `
            SELECT 
              id, 
              company_code, 
              token 
            FROM company 
            WHERE status = TRUE AND name = $1
        `;
    const values = [name];

    // Ejecución de la consulta
    const resultCompany = await dbConnectionProvider.firstOrDefault(
      queryCompany,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultCompany;
  } catch (err) {
    loggerGlobal.error(`Error al obtener la empresa con nombre, servicio ("getCompanyByName")`, err);
    throw new Error(
      "Error al obtener la información de la empresa. Intente nuevamente."
    );
  }
};

const createCompany = async (companyCode, nameCompany, token) => {
  try {
    const values = {
      company_code: companyCode,
      name: nameCompany,
      token: token,
      status: true,
      creation_date: new Date(),
    };

    // Ejecución de la consulta
    const resultCompany = await dbConnectionProvider.insertOne(
      "company",
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultCompany;
  } catch (err) {
    loggerGlobal.error(`Error al crear la empresa: ${name}`, err);
    throw new Error("Error al crear la empresa. Intente nuevamente.");
  }
};

const deleteCompany = async (companyId) => {
  try {
    let companyValue = {
      status: false,
    };

    companyValue = await dbConnectionProvider.updateOne(
      "company",
      companyValue,
      null,
      { id: companyId }
    );

    if (
      typeof companyValue === "undefined" ||
      companyValue === null ||
      companyValue.length === 0
    ) {
      throw new Error("Error al eliminar la empresa");
    }

    return true;
  } catch (error) {
    loggerGlobal.error("Error al eliminar la empresa");
    throw new Error("Error al eliminar la empresa. Intente nuevamente.");
  }
};

const companyDAO = {
  getCompanyByCode,
  createCompany,
  getCompanyByName,
  deleteCompany,
};

export { companyDAO };
