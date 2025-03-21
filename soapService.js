const express = require("express");
const soap = require("soap");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");
const { SignedXml } = require("xml-crypto");
require("dotenv").config();

const app = express();

// Load Private Key and Certificate for Signing
const privateKey = fs.readFileSync(path.join(__dirname, "private.pem"), "utf8");
const publicCert = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");

// Sample SOAP Service Logic
const service = {
  SecureService: {
    SecurePort: {
      sayHello: function (args) {
        return { message: `Hello, ${args.name}` };
      },
    },
  },
};

// Load WSDL File
const wsdlPath = path.join(__dirname, "service.wsdl");
const wsdl = fs.readFileSync(wsdlPath, "utf8");

// WS-Security Middleware
app.use((req, res, next) => {
  let xml = "";

  req.on("data", (chunk) => {
    xml += chunk;
  });

  req.on("end", () => {
    // Parse XML & Validate WS-Security Header
    if (!validateWSSecurity(xml)) {
      return res.status(401).send("Unauthorized: Invalid WS-Security Signature");
    }
    next();
  });
});

// Create SOAP Server
const server = app.listen(8000, () => {
  console.log("SOAP service running at http://localhost:8000/wsdl");
});

soap.listen(server, "/wsdl", service, wsdl);
