# 变更记录

本文件按「值得一提的改动」记，不追求逐 commit 对应。

## 0.1.0 — 2026-10-04

首个版本：Codex 式推理等级滑条组件 + DSH 客户端插件。

**组件（`src/reasoning-slider.js`）**

- 自定义元素 `<dsh-reasoning-slider>`，Shadow DOM、零依赖；拖动 / 点按 / 键盘（`←→↑↓ Home End PgUp PgDn 1-9`）换档。
- 几何按参考图量取：拇指直径 ≈ 轨道高度 ×1.57，且**两端与轨道齐平**（`--rs-pad = 拇指半径`）。
- 填充（含渐变）铺满整条胶囊、用 `clip-path` 裁到拇指圆心，渐变不随进度压缩。
- 三档外观按位置自动：普通档纯蓝；次高档渐入紫 + 细密火星；最高档满配渐变 + 火星扫掠、标题转紫。
- 火星两层（主层 76 颗 0.6–2.1px / 细层 104 颗 0.5–1.3px），相位按填充长度实时计算，扫掠方向**自左向右**。
- 档位圆点默认关闭（`dots` 属性可开启）；`dark` 属性与 `:host-context([data-ds-dark-theme])` 支持深色主题。
- 卡片形态（`card`）：居中档位名 + 可点击的模型行 + 满宽轨道；`subtitle` 属性/property 双向可用。
- 无障碍：`role="slider"` + `aria-valuemin/max/now/valuetext`；`prefers-reduced-motion` 下去掉位移与脉冲。

**插件（`src/seat.js`）**

- 以 `priority: -1` 顶替作曲栏官方模型芯片（`conversation.input.model`），被拒时降级到 `conversation.input.right`（`SEAT_MODE` 可切换）。
- 接入官方 `modelDirectories`，换档/换模型都走同一个 `directory.select`；档位名按位置映射为 轻度/中/高/极高。
- 自带模型菜单（点模型名那一行打开），支持键盘导航、点击外部关闭。
- 座位元素常驻诊断属性 `data-session / data-available / data-groups / data-levels / data-problem`。

**构建与验证（`build.mjs`、`tools/`）**

- `build.mjs` 生成 `lib/client.js`（`window.__ModuleLoader__.load` 形式）与三个演示页，并内置
  “产物必须能解析”的闸门：语法不过直接 `exit 1`。
- `tools/check-bundle.mjs` 模拟加载器校验契约：只注册一次、id 等于包名、导出面完整。
- `tools/seat-smoke.mjs` 用 stub React + 假服务作用域跑挂载层。
- `tools/probe-app.mjs` 通过 CDP 驱动真实实例读回 DOM/控制台并截图。
- 修掉的三个真问题（详见 README「三个踩过的坑」）：注册 id 与 patch 行名不一致导致
  `duplicate factory registration` 中止启动；座位 effect 依赖回调触发 React #185 无限渲染；
  缺少 `remote` / `remote.session` 注入声明导致座位空白。
