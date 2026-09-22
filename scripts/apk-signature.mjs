import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';

const file=process.argv[2];
if(!file){
  console.error('Uso: node scripts/apk-signature.mjs archivo.apk [--sha1]');
  process.exit(2);
}

const apk=fs.readFileSync(file);
const eocdMagic=Buffer.from([0x50,0x4b,0x05,0x06]);
const signingMagic=Buffer.from('APK Sig Block 42','ascii');
const eocd=apk.lastIndexOf(eocdMagic);
if(eocd<0||eocd+20>apk.length)throw new Error('APK inválido: no se encontró el directorio ZIP');

const centralDirectory=apk.readUInt32LE(eocd+16);
const footer=centralDirectory-24;
if(footer<0||!apk.subarray(footer+8,footer+24).equals(signingMagic)){
  throw new Error('El APK no contiene un bloque de firma v2/v3');
}

const blockSize=Number(apk.readBigUInt64LE(footer));
const blockStart=centralDirectory-(blockSize+8);
if(blockStart<0||apk.readBigUInt64LE(blockStart)!==BigInt(blockSize)){
  throw new Error('Bloque de firma APK dañado');
}

const ids=new Set([0x7109871a,0xf05368c0,0x1b93ad61]);
let value;
let cursor=blockStart+8;
while(cursor<footer){
  const entrySize=Number(apk.readBigUInt64LE(cursor));
  cursor+=8;
  if(entrySize<4||cursor+entrySize>footer)throw new Error('Entrada de firma APK inválida');
  const id=apk.readUInt32LE(cursor);
  if(ids.has(id)&&!value)value=apk.subarray(cursor+4,cursor+entrySize);
  cursor+=entrySize;
}
if(!value)throw new Error('No se encontró un firmante APK v2/v3');

function lp32(buffer,offset=0){
  if(offset+4>buffer.length)throw new Error('Estructura de firma incompleta');
  const length=buffer.readUInt32LE(offset);
  const start=offset+4;
  const end=start+length;
  if(end>buffer.length)throw new Error('Longitud inválida en la firma APK');
  return {value:buffer.subarray(start,end),next:end};
}

const signers=lp32(value).value;
const signer=lp32(signers).value;
const signedData=lp32(signer).value;
const digests=lp32(signedData);
const certificates=lp32(signedData,digests.next).value;
const certificateDer=lp32(certificates).value;
const certificate=new X509Certificate(certificateDer);

const result={
  sha1:certificate.fingerprint.toUpperCase(),
  sha256:certificate.fingerprint256.toUpperCase(),
  subject:certificate.subject,
  issuer:certificate.issuer,
  validFrom:certificate.validFrom,
  validTo:certificate.validTo,
};

if(process.argv.includes('--sha1'))process.stdout.write(result.sha1+'\n');
else process.stdout.write(JSON.stringify(result,null,2)+'\n');
