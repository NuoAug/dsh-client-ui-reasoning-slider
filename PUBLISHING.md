# 上传到 GitHub

仓库地址：<https://github.com/NuoAug/dsh-client-ui-reasoning-slider>

本文件夹已经是**完整可用的项目**（含已构建的 `lib/`），元数据（`package.json`、`LICENSE`、README 里的安装示例）都已填成 `NuoAug`。

## 一、推送本次改动

远端已有的首个提交作者是正确的（`NuoAug <DJH080140@outlook.com>`），**不需要改写历史**，直接推即可：

```powershell
git push
```

本地当前比远端多一个提交（新增真实实例效果图与截图脚本）。

## 二、日常推送

```powershell
git add -A
git commit -m "fix: …"
git push
```

改了 `src/` 之后先构建，产物会一起提交（CI 会检查两者是否同步）：

```powershell
node build.mjs
```

## 三、把项目交给别人 / 换机器

压缩包里已经包含构建好的产物与三个演示页，**接收方不装 Node 也能双击 `demo.html` 看交互演示**。

如果对方要自己建仓：

```powershell
pwsh -File .\setup-git.ps1 -Name "你的显示名" -Email "you@users.noreply.github.com" `
     -Remote "https://github.com/<you>/dsh-client-ui-reasoning-slider.git"
```

## 四、可选：发布到 npm

`package.json` 里的 `private` 已去掉，`files` 白名单只打包 `lib/` + `cordis.patch.yml` + 文档：

```powershell
npm publish --access public
```

## 五、几点说明

- **`demo/*.html` 是构建产物**（由 `demo/*-template.html` 生成），在 git 里被 `.gitignore` 排除；压缩包中带着它们，是为了不装 Node 也能直接看演示。首次推送后仓库里没有这三个文件，属预期。
- **`lib/client.js` 提交进仓库**：DSH 客户端插件靠它加载，消费者装完即用，无需构建。
- **不要提交 `.git`、`node_modules`**：前者随环境而变，后者体积大且可由依赖声明还原。
- CI（`.github/workflows/check.yml`）在 push / PR 时跑：构建闸门 → 加载器契约 → 产物与演示页语法 → 挂载层冒烟 → `lib/` 与 `src/` 一致性。都不需要 DSH 本体。

## 六、改过截图后要换文件名

GitHub 渲染 README 里的相对路径图片时，URL 只跟**文件名**有关；文件内容变了但名字没变，
浏览器与 GitHub 的边缘缓存会继续显示旧图（硬刷新也常常绕不过）。所以**替换截图时请同时改名**（例如 pp-light-tiers-v2.png）
并更新 README 里的引用——本项目已经因为这个问题踩过一次。
