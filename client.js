const soap = require("soap");
const fs = require("fs");
const path = require("path");
const { SignedXml } = require("xml-crypto");

const WSDL_URL = "http://localhost:8000/wsdl";

// Load Private Key
const privateKey = fs.readFileSync(path.join(__dirname, "private.pem"), "utf8");

// Sign SOAP Message
function signXml(xml) {
  const sig = new SignedXml();
  sig.addReference("/*");
  sig.signingKey = privateKey;
  sig.computeSignature(xml);
  return sig.getSignedXml();
}

// Call SOAP Service with WS-Security
soap.createClient(WSDL_URL, (err, client) => {
  if (err) return console.error("SOAP Client Error:", err);

  const args = { name: "Aadish" };

  client.sayHello(args, (err, result) => {
    if (err) return console.error("SOAP Request Error:", err);

    console.log("Response:", result);
  });
});
