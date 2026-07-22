# 鱼管家 Next.js

手机端鱼塘喂料、饲料库存、鱼塘备忘和设置管理页面。项目使用 Next.js 静态导出和 Firebase Realtime Database，能够部署到 GitHub Pages。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:3000/?preview=1` 可使用完全本地的演示数据。打开 `?readonly=1` 可读取真实 Firebase 数据但禁止页面写入。

## 检查与构建

```bash
npm run typecheck
npm run lint
npm run build
```

静态站点生成在 `out/`。推送到 GitHub 仓库的 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动构建并发布。

## 数据兼容

项目沿用原有 Firebase 路径，不迁移、不重命名已有数据：

- `settings/ponds`
- `settings/warehouses`
- `settings/feedTypes`
- `settings/feedSpecs`
- `feedRecords`
- `stockLogs`
- `stockTotals`
- `pondMemos`

库存扣减使用 Firebase transaction。鳗鱼料按斤记录和扣库存，其他饲料按包记录并根据每包斤数换算库存。
