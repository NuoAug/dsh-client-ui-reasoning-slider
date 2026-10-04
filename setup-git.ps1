# 在解压出来的项目文件夹里初始化 git 并做首次提交。
#
#   pwsh -File .\setup-git.ps1 -Name "你的显示名" -Email "you@users.noreply.github.com"
#   pwsh -File .\setup-git.ps1 -Name "..." -Email "..." -Remote "https://github.com/<you>/dsh-client-ui-reasoning-slider.git"
#
# 身份只写在**本仓库**（git config --local），不动机器上的全局配置。
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$Email,
  [string]$Remote = ""
)

$ErrorActionPreference = "Stop"

if (Test-Path ".git") {
  throw "当前目录已经是 git 仓库；要改作者请用：git commit --amend --reset-author --no-edit"
}

$message = @'
feat: Codex 式推理等级滑条（组件 + DSH 客户端插件）

- 组件 src/reasoning-slider.js：自定义元素 + Shadow DOM，拖动/点按/键盘换档，
  三档外观（纯蓝 / 渐入紫+细密火星 / 满配渐变+火星扫掠），深浅主题，自带模型菜单
- 插件 src/seat.js：以 priority -1 接管作曲栏模型位，被拒时降级到右侧 list 槽，
  接入官方 modelDirectories，档位名按位置映射为 轻度/中/高/极高
- 构建 build.mjs：生成 lib/client.js 与三个演示页，内置“产物必须能解析”的闸门
- 验证 tools/：加载器契约校验、挂载层冒烟（stub React）、CDP 真机探针、扫掠方向检测
- 文档：README、CHANGELOG、PUBLISHING、MIT LICENSE、GitHub Actions
'@

git init -b main | Out-Null
git config --local user.name $Name
git config --local user.email $Email
git add -A

$msgFile = Join-Path ([System.IO.Path]::GetTempPath()) "dsh-slider-commit-msg.txt"
[System.IO.File]::WriteAllText($msgFile, $message, (New-Object System.Text.UTF8Encoding($false)))
git commit -q -F $msgFile
Remove-Item $msgFile -Force

if ($Remote -ne "") {
  git remote add origin $Remote
  Write-Host "已添加 remote: $Remote"
}

Write-Host ""
git log --oneline -1
Write-Host ""
git status --short --branch
Write-Host ""
if ($Remote -eq "") {
  Write-Host "下一步："
  Write-Host "  git remote add origin https://github.com/<you>/dsh-client-ui-reasoning-slider.git"
  Write-Host "  git push -u origin main"
} else {
  Write-Host "下一步：git push -u origin main"
}
