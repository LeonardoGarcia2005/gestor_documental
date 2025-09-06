export const normalizeFolderName = (name) => {
  if (!name || typeof name !== "string") {
    throw new Error(
      "El nombre de la carpeta es requerido"
    );
  }

  return name
    .normalize("NFD") // Descompone los acentos
    .replace(/[\u0300-\u036f]/g, "") // Elimina los acentos
    .replace(/ñ/g, "n") // Reemplaza ñ
    .replace(/Ñ/g, "N") // Reemplaza Ñ
    .replace(/\s+/g, "pisos") // Reemplaza espacios por 'pisos'
    .toLowerCase(); // (opcional) todo en minúsculas
};

export const normalizeCompanyName = (companyName) => {
  return companyName
    .trim() // Elimina espacios al inicio y final
    .replace(/[^\w\s&.-]/g, "") // Solo permite letras, números, espacios, &, . y -
    .replace(/\s+/g, " ") // Reemplaza múltiples espacios por uno solo
    .replace(/^[.\s-]+|[.\s-]+$/g, "") // Elimina puntos, espacios o guiones al inicio/final
    .slice(0, 100); // Limita a 100 caracteres máximo
};
