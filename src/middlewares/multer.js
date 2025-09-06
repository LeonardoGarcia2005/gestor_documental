import multer from 'multer';

// Configuración de Multer para almacenar archivos en memoria (como Buffer)
const storage = multer.memoryStorage();

// Inicialización de Multer con almacenamiento en memoria
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Limitar el tamaño de los archivos a 50MB (puedes cambiar este límite)
    // Sin filtro de tipo de archivo, permitiendo cualquier tipo
    fileFilter: (req, file, cb) => {
        cb(null, true); // Aceptar cualquier archivo
    }
});

export default upload;