export const getFiles = async (req, res) => {
  const { documentIdentifiers, codes } = req.body;
  const permissions = req.permissions; // Permisos del usuario
  const companyId = req.company.company_id; // ID de la empresa

  try {
    // Validación de longitud de 'codes' y 'documentIdentifiers'
    if (codes.length !== documentIdentifiers.length) {
      return res.status(400).json({
        error: `La cantidad de códigos (${codes.length}) no coincide con la cantidad de identificadores (${documentIdentifiers.length}).`,
      });
    }

    // Llamada al servicio para obtener archivos
    const result = await filesService.getFiles(
      documentIdentifiers,
      codes,
      permissions,
      companyId
    );

    // Respuesta exitosa
    res.status(200).json({ data: result });
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ error: error.message });
  }
};

export const getFilesWithoutCompany = async (req, res) => {
  const { codes } = req.body;

  if (!codes || codes.length === 0) {
    return res.status(400).json({
      error: `No se han proporcionado códigos.`,
    });
  }

  try {
    const result = await filesService.getFilesWithoutCompany(codes);

    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};
