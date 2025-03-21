const { DOMParser } = require("xmldom");
const { SignedXml } = require("xml-crypto");
const fs = require("fs");
const path = require("path");

// Load Public Key for Verification
const publicCert = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");

function validateWSSecurity(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const signature = new SignedXml();

  const sigNode = doc.getElementsByTagName("Signature")[0];
  if (!sigNode) return false;

  signature.keyInfoProvider = {
    getKeyInfo: () => "<X509Data></X509Data>",
    getKey: () => publicCert,
  };

  signature.loadSignature(sigNode);
  return signature.checkSignature(xml);
}

module.exports = validateWSSecurity;
