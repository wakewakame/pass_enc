import CryptoJS from "crypto-js";
import QRCode from "qrcode";

const openssl = {
  encrypt: (plaintext, password, iter) => {
    // 以下のコマンドと同様の結果を得る
    //   echo "${plaintext}" | openssl aes-256-cbc -e -pbkdf2 -iter ${iter} -base64 -A -k "${password}"

    // AES では暗号化/復号化のために key, iv を必要とする。
    // そして最初に示した openssl のコマンドでは password を元に pbkdf2 でストレッチングされた結果を key, iv として利用している。
    // そのため、ここでも OpenSSL と同様の手順で key, iv を得る。
    const saltWA = CryptoJS.lib.WordArray.random(8);
    const keyIvWA = CryptoJS.PBKDF2(password, saltWA, {
      keySize: (32 + 16) / 4,
      iterations: iter,
      hasher: CryptoJS.algo.SHA256
    });
    const keyWA = CryptoJS.lib.WordArray.create(keyIvWA.words.slice(0, 32 / 4));
    const ivWA = CryptoJS.lib.WordArray.create(keyIvWA.words.slice(32 / 4, (32 + 16) / 4));

    // 暗号化
    const ciphertextWA = CryptoJS.AES.encrypt(plaintext, keyWA, {
      iv: ivWA,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).ciphertext;

    // encrypted の先頭には salt を書く必要があるため、 salt と暗号データを結合する
    const encryptedWA = CryptoJS.lib.WordArray.create([
      ...CryptoJS.enc.Utf8.parse("Salted__").words, ...saltWA.words, ...ciphertextWA.words
    ]);
    const encrypted = encryptedWA.toString(CryptoJS.enc.Base64);
    return encrypted;
  },
  decrypt: (encrypted, password, iter) => {
    // 以下のコマンドと同様の結果を得る
    //   echo "${encrypted}" | openssl aes-256-cbc -d -pbkdf2 -iter ${iter} -base64 -A -k "${password}"

    // encrypted の先頭には salt があるため、 salt と暗号データをそれぞれ分離する
    const encryptedWA = CryptoJS.enc.Base64.parse(encrypted);
    const saltWA = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(8 / 4, 16 / 4));
    const ciphertextWA = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(16 / 4, encryptedWA.words.length));

    // AES では暗号化/復号化のために key, iv を必要とする。
    // そして最初に示した openssl のコマンドでは password を元に pbkdf2 でストレッチングされた結果を key, iv として利用している。
    // そのため、ここでも OpenSSL と同様の手順で key, iv を得る。
    const keyIvWA = CryptoJS.PBKDF2(password, saltWA, {
      keySize: (32 + 16) / 4,
      iterations: iter,
      hasher: CryptoJS.algo.SHA256
    });
    const keyWA = CryptoJS.lib.WordArray.create(keyIvWA.words.slice(0, 32 / 4));
    const ivWA = CryptoJS.lib.WordArray.create(keyIvWA.words.slice(32 / 4, (32 + 16) / 4));

    // 復号化
    const decryptedWA = CryptoJS.AES.decrypt({ciphertext: ciphertextWA}, keyWA, {
      iv: ivWA,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const decrypted = decryptedWA.toString(CryptoJS.enc.Utf8)
    return decrypted;
  }
};

window.decrypt = async () => {
  const formValue = Object.fromEntries(["encrypted", "password", "iterations"]
    .map((elemId) => [elemId, document.getElementById(elemId).value])
  );
  const decrypted = openssl.decrypt(formValue["encrypted"], formValue["password"], formValue["iterations"]);
  const accounts = JSON.parse(decrypted);
  const accountsDom = await Promise.all(accounts.map(async (account) => {
    const container = document.createElement("div");

    const title = document.createElement("p");
    title.innerHTML = account["service"];
    container.appendChild(title);

    const svg = await QRCode.toString(JSON.stringify(account), {
      errorCorrectionLevel: "M",
      type: "svg",
      margin: 1
    });
    const qr = document.createElement("div");
    qr.style = "width: 256px; height: 256px";
    qr.innerHTML = svg;
    container.appendChild(qr);

    return container;
  }));
  accountsDom.forEach((accountDom) => {
    document.getElementById("qr").appendChild(accountDom);
  });
};
