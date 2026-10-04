# 上传到 GitHub

本文件夹是**完整可用的项目**（含已构建的 `lib/`）。

## 一、占位符已替换

以下位置的 `GITHUB_USER` 已替换为 GitHub 用户名 `NuoAug`：

| 文件 | 位置 |
| --- | --- |
| `package.json` | `author`、`homepage`、`repository.url`、`bugs.url` |
| `LICENSE` | 版权人一行 |
| `README.md` | 安装章节的 `github:NuoAug/...` |

## 二、建空仓库并推送

在 GitHub 上**新建一个空仓库**（不要勾选 README / .gitignore / License，否则会冲突），然后：

```powershell
git remote add origin https://github.com/NuoAug/dsh-client-ui-reasoning-slider.git
git push -u origin main
```

若这个文件夹还不是 git 仓库（从压缩包解出来的情况），先用第三节的脚本。

## 三、初始化 git（仅压缩包解出的新文件夹需要）

```powershell
pwsh -File .\setup-git.ps1 -Name "NuoAug" -Email "DJH080140@outlook.com"
```

它会 `git init -b main`、写入**仓库级**身份（不动你机器上的全局配置）、`git add -A` 并提交。

如果提交作者需要修改：

```powershell
git config user.name "NuoAug"
git config user.email "DJH080140@outlook.com"
git commit --amend --reset-author --no-edit
```

## 四、可选：发布到 npm

`package.json` 里的 `private` 已去掉，`files` 白名单只打包 `lib/` + `cordis.patch.yml` + 文档：

```powershell
npm publish --access public
```

## 五、几点说明

- **`demo/*.html` 是构建产物**（由 `demo/*-template.html` 生成），在 git 里被 `.gitignore` 排除；
  压缩包中带着它们，是为了让你**不装 Node 也能双击 `demo.html` 看交互演示**。首次推送后仓库里没有这三个文件，这是预期行为。
- **`lib/client.js` 是提交进仓库的**：DSH 客户端插件靠它加载，消费者装完即用，不需要构建。
- 改了 `src/` 之后：

  ```powershell
  node build.mjs    # 生成 lib/client.js 与三个演示页；产物语法不过会直接构建失败
  ```

- **不要提交 `.git`、`node_modules`**：前者随各人环境而变，后者体积大且可由依赖声明还原。
- CI（`.github/workflows/check.yml`）在 push / PR 时跑构建闸门、加载器契约、挂载层冒烟与产物一致性，不需要 DSH 本体即可执行。
