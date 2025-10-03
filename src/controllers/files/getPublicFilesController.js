export const getPublicFiles = async (req, res) => {
  const { files } = req.body;

  try {

    // Respuesta exitosa
    res.status(200).json({ message: "Archivos obtenidos exitosamente" });
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ error: error.message });
  }
};
