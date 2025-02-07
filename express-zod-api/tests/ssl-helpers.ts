import forge from "node-forge";

const certAttr = [
  { name: "commonName", value: "localhost" },
  { name: "countryName", value: "DE" },
  { name: "organizationName", value: "ExpressZodAPI" },
  { shortName: "OU", value: "DEV" },
];

const certExt = [
  { name: "basicConstraints", cA: true },
  { name: "extKeyUsage", serverAuth: true, clientAuth: true },
  { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] },
  {
    name: "keyUsage",
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
];

export const signCert = () => {
  (forge as any).options.usePureJavaScript = true;
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  cert.setSubject(certAttr);
  cert.setIssuer(certAttr);
  cert.setExtensions(certExt);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
};
