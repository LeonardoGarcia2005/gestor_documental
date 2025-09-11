import { Router } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import createCompanyAndToken from "../controllers/company/createCompany.js"
import deleteCompany from "../controllers/company/deleteCompany.js";

const router = Router();

//-------------Servicios para la empresa--------------//
router.post("/createCompany", verifyAccessToken, createCompanyAndToken);
router.delete("/deleteCompany", verifyAccessToken, deleteCompany);
