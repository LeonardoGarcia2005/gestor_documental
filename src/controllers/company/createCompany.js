import { companyDAO } from "../../dataAccessObjects/companyDAO.js";
import { createAccessToken } from "../../lib/jwt.js";
import { generateCompanyCode } from "../../lib/generators.js";
import { normalizeCompanyName } from "../../lib/formatters.js";
import { generateCompanyCode } from "../../lib/generators.js";

const createCompanyAndToken = async (req, res) => {
  try {
    // Validar que los datos requeridos estén presentes
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "El nombre de la empresa es requerido.",
      });
    }

    // Ajustar el nombre de la empresa para evitar
    const nameFormatted = normalizeCompanyName(name);

    // Verificar si la empresa ya existe
    const existingCompany = await companyDAO.getCompanyByName(nameFormatted);
    if (existingCompany) {
      return res.status(200).json({
        token: existingCompany.token,
        token_type: "bearer",
        companyCode: existingCompany.company_code,
      });
    }

    // Generar un código único para la empresa
    const companyCode = generateCompanyCode();

    // Crear el token usando la utilidad
    const token = await createAccessToken(companyCode, true);

    // Llamar al servicio para crear la empresa
    await companyDAO.createCompany(companyCode, name, token);

    // Enviar la respuesta con el token
    return res.status(200).json({ token, token_type: "bearer", companyCode });
  } catch (error) {
    return res.status(500).json({
      error:
        "Ocurrio un error a la hora de crear la empresa y el token",
      details: error.message,
    });
  }
};

export default createCompanyAndToken;
