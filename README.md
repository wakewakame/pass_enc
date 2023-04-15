# pass\_enc

[KeePass](https://keepass.info/) によって暗号化されたアカウント一覧を印刷するためのツールです。

demo: [pass\_enc](https://wakewakame.github.io/pass_enc/dist/index.html)

# 使い方

`kdbx4 file` / `password` にそれぞれ KeePass のデータベース / パスワードを入力し `print` ボタンを押すと数十秒後にアカウント一覧が表示されます。
この状態でブラウザの印刷機能を用いて印刷します。

注意: Chrome / Edge 以外のブラウザでは印刷時のレイアウトが崩れてしまうようです。

# ビルド方法

```bash
git clone https://github.com/wakewakame/pass_enc.git
cd pass_enc
npm install
npm run build
```

`pass_enc/dist` にビルドの成果物が生成されます。

