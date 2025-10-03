import path from "path";

export const normalizeFolderName = (name) => {
  if (!name || typeof name !== "string") {
    throw new Error("El nombre de la carpeta es requerido");
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

// Sanitizar nombre
export const sanitizeFileName = (filename, maxFilenameLength) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);

  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/[-_]{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");

  const finalName = sanitizedName || `archivo_${Date.now()}`;
  const truncatedName = finalName.substring(0, maxFilenameLength);

  return `${truncatedName}${ext.toLowerCase()}`;
};

export const normalizeDate = (date, fallbackYears = 0) => {
  if (!date) {
    const d = new Date();
    if (fallbackYears) d.setFullYear(d.getFullYear() + fallbackYears);
    return d.toISOString().split("T")[0]; // siempre YYYY-MM-DD
  }

  const d = new Date(date); // convierte string a Date
  if (isNaN(d)) {
    const today = new Date();
    if (fallbackYears) today.setFullYear(today.getFullYear() + fallbackYears);
    return today.toISOString().split("T")[0];
  }

  return d.toISOString().split("T")[0];
};

export const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0]; 
};
