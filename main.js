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
  let accounts = JSON.parse(decrypted);
  if (!Array.isArray(accounts)) {
    accounts = [accounts];
  }

  const qrElem = document.getElementById("qr");
  while (qrElem.firstChild) {
    qrElem.removeChild(qrElem.firstChild);
  }

  const accountsDom = accounts.map((account) => {
    const container = document.createElement("div");

    const qr = document.createElement("div");
    qr.style = "width: 256px; height: 256px; background: #eee";
    container.appendChild(qr);

    document.getElementById("qr").appendChild(container);
    const title = document.createElement("div");
    title.innerHTML = `<h1>${account["service"]}</h1><pre>echo "\${base64}" | openssl aes-256-cbc -d -pbkdf2 -iter ${formValue["iterations"]} -base64 -A -k "\${password}"</pre>`;
    container.appendChild(title);

    return [account, qr];
  });
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
  for (let [account, qr] of accountsDom) {
    const enc = openssl.encrypt(JSON.stringify(account), formValue["password"], formValue["iterations"]);
    const svg = await QRCode.toString(enc, {
      errorCorrectionLevel: "L",
      type: "svg",
      margin: 1
    });
    qr.innerHTML = svg;

    // 画面を更新するためのスリープ
    await sleep(0);
  }
};
