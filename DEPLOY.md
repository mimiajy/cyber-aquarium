# GitHub Pages 部署

项目为纯静态 HTML / CSS / JavaScript / Canvas 2D / WebGL，无后端、付费 API、运行时外部资源或 npm 依赖。构建按清单逐字节复制最新场景，不改写绘制算法。此前的 Netlify 专用配置已移除。

## 本地使用

- 开发：`npm start` 或 `npm run dev`。
- 检查并构建：`npm run build`，输出 `dist/`。
- 产物检查：`npm run check:dist`。
- 产物预览：`npm run preview`，打开终端显示的本机地址。

无需 npm install。请修改源文件，不要直接编辑 dist；dist 和 build-report.json 不提交到仓库。

## 已部署站点

- 仓库：https://github.com/mimiajy/cyber-aquarium
- 网站：https://mimiajy.github.io/cyber-aquarium/
- 自动部署：https://github.com/mimiajy/cyber-aquarium/actions/workflows/deploy-pages.yml
- 主分支：main；Pages 发布源：GitHub Actions。

源码已在用户确认公开后上传。首次 Actions 的 build 和 deploy 任务均已成功完成。提交使用 GitHub noreply 邮箱，不公开本机私人邮箱。运行资源保持原样，无需本机持续开机。

## 自动部署流程

配置文件：`.github/workflows/deploy-pages.yml`。

- 触发：push 到 main，或在 Actions 页面手动运行 workflow_dispatch。
- 构建：官方 checkout、Node.js 22，执行 npm run build。
- 上传：actions/upload-pages-artifact 打包 dist，不上传整个项目目录。
- 部署：actions/configure-pages 和 actions/deploy-pages，通过 github-pages 环境发布。
- 权限：源码只读；部署任务额外获得 pages: write 与 id-token: write；不需要自行保存部署 token。
- 同一站点部署串行执行，避免中途取消已经开始的发布。

## 子路径兼容

页面运行资源均使用相对路径。当前场景位于 prototypes/fantasy-reef/，图像地址相对 app.js 的实际 URL 解析；首页链接为 ./。音乐由本地 Web Audio 合成，无额外音频文件 URL。没有写死运行域名、根路径 /assets 或 localhost。

构建检查同时按网站根目录 / 和项目子路径 /cyber-aquarium/ 解析全部静态引用，防止资源意外指向用户名站点的根目录。dist 内包含 .nojekyll，使用 Actions 直接发布产物，不通过 Jekyll 转换。

本地预览器默认在根路径运行；项目子路径已通过本地模拟挂载核对。线上验收以公开站点的 HTTP 状态、文件摘要及资源类型为准。纯静态单页没有客户端子路径路由，不需要 SPA 重写。

## 以后更新

继续让 Codex 修改项目并检查，然后说：“提交并推送到 main，检查 Pages 部署”。推送后 GitHub Actions 自动构建并更新同一个网址，不需要手工上传 dist 或一直运行本机服务器。

如某次工作流失败，查看 Actions 的失败步骤；可由 Codex修复并重新推送。不要强制覆盖远端历史。

主题、数量和音量偏好使用浏览器 localStorage；每次打开音乐仍默认关闭。本机地址与线上域名分别保存设置。没有购买服务器、配置后端或使用 Netlify 的步骤。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 当前发布范围

根 index.html 是唯一正式页面，接入最新半写实画风、三鱼种、动态图集性能优化与原创环境音乐。运行清单位于 scripts/runtime-files.mjs；默认构建不再发布早期 V1。历史代码和 Git 历史保留。

构建自动运行既有检查、当前鱼群、渲染与音频回归测试。npm run build:study 仍可生成本地测试产物，但 study-dist 不参与 Pages 部署。tests/、perf/、QA 图、提示词和凭据不进入正式站点产物。
