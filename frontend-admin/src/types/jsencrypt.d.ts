// JSEncrypt 类型声明
declare module 'jsencrypt' {
  export class JSEncrypt {
    constructor(options?: { default_key_size?: number });
    setPublicKey(publicKey: string): this;
    setPrivateKey(privateKey: string): this;
    encrypt(data: string): string | false;
    decrypt(data: string): string | false;
    getPublicKey(): string;
    getPrivateKey(): string;
    getPublicKeyB64(): string;
    getPrivateKeyB64(): string;
  }
  export default JSEncrypt;
}
