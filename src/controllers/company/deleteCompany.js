import { companyDAO } from "../../dataAccessObjects/companyDAO.js";

const deleteCompany = async (req, res) => {
  try {
    // Validar que los datos requeridos estén presentes
    const { company_code } = req.body;
    if (!company_code) {
      return res.status(400).json({
        error: "El codigo de la empresa es requerida.",
      });
    }
    // Verificar que la empresa exista
    const existingCompany = await companyDAO.getCompanyByCode(company_code);
    if (!existingCompany) {
      return res.status(404).json({
        error: `No se encontro ninguna empresa con ese id.`,
      });
    }

    // Eliminar el registro en la base de datos
    const response = await companyDAO.deleteCompany(existingCompany.id);
    if (response) {
      return res
        .status(200)
        .json({ message: "Empresa eliminada correctamente." });
    }
  } catch (error) {
    return res.status(500).json({
      error:
        "Hubo un error al intentar eliminar la empresa. Por favor, intente nuevamente.",
      details: error.message,
    });
  }
};

export default deleteCompany;
