import { Router } from "express";
import createCompanyAndToken from "../controllers/company/createCompany.js"
import deleteCompany from "../controllers/company/deleteCompany.js";

const router = Router();

//-------------Servicios para la empresa--------------//
router.post("/createCompany", createCompanyAndToken);
router.delete("/deleteCompany", deleteCompany);

export default router;