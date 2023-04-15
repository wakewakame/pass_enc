'use strict';

import CryptoJS from "crypto-js";
import * as kdbxweb from "kdbxweb";
import QRCode from "qrcode";
import argon2 from "./argon2";

const openssl = {
  // 暗号化
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

  // 復号化
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

const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

kdbxweb.CryptoEngine.setArgon2Impl(argon2);

const showAccounts = async () => {
  // kdbx からアカウント一覧を復元
  const kdbx = document.getElementById("kdbx").files[0];
  const password = document.getElementById("password").value;
  const accounts = await (new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(password));
        const db = await kdbxweb.Kdbx.load(reader.result, credentials);
        const parseGroup = (groups) => groups.map((group) => [
          ...group.entries.map((entry) =>
            Object.fromEntries([...entry.fields.entries()].map(([key, value]) => [
              key, (value instanceof kdbxweb.ProtectedValue) ? value.getText() : value
            ]))
          ),
          ...parseGroup(group.groups),
        ]).reduce((a, b) => [...a, ...b], []);
        const accounts = parseGroup(db.groups);
        resolve(accounts);
      };
      reader.readAsArrayBuffer(kdbx);
    }
    catch (e) {
      reject(e);
    }
  }));

  // アカウント一覧の表示をリセット
  const accountsElem = document.getElementById("accounts");
  while (accountsElem.firstChild) {
    accountsElem.removeChild(accountsElem.firstChild);
  }

  // アカウント一覧の表示
  const accountTemplateElem = document.getElementById("account-template");;
  accounts.forEach((account) => {
    const accountElem = accountTemplateElem.content.cloneNode(true);
    accountElem.querySelector(".account").dataset.account = JSON.stringify(account);
    accountElem.querySelector(".title").textContent = account["Title"];
    accountsElem.appendChild(accountElem);
  });

  // アカウント情報の暗号化 & QR Code のレンダリング
  for (const accountElem of document.querySelectorAll(".account")) {
    const enc = openssl.encrypt(accountElem.dataset.account, password, 10000);
    const svg = await QRCode.toString(enc, { errorCorrectionLevel: "L", type: "svg", margin: 1 });
    accountElem.querySelector(".qr").innerHTML = svg;

    // このループの完了には時間がかかる
    // DOM の応答が停止するのを防ぐため、定期的に処理を譲る
    await sleep(0);
  }
};

//showAccounts();
document.getElementById("print").addEventListener("click", showAccounts);

