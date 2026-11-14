# GitHub Pages 部署

项目为纯静态 HTML / CSS / JavaScript / p5.js，无后端、付费 API、运行时外部资源或 npm 依赖。构建不修改视觉设计、绘制算法或交互代码。此前的 Netlify 专用配置已移除。

## 本地使用

- 开发：`npm start` 或 `npm run dev`。
- 检查并构建：`npm run build`，输出 `dist/`。
- 产物检查：`npm run check:dist`。
- 产物预览：`npm run preview`，打开终端显示的本机地址。

无需 npm install。请修改源文件，不要直接编辑 dist；dist 和 build-report.json 不提交到仓库。

## 首次发布

公开仓库前先核对 PUBLICATION_REVIEW.md 中的本地检查记录，并取得用户确认。该记录及 STATUS.md 不会提交。

确认后由 Codex 完成：

1. 使用已登录的 GitHub 身份核对同名仓库；不存在时创建公开仓库 cyber-aquarium，不覆盖已有远程内容。
2. 为当前项目设置 origin，并以 main 作为主分支。首次提交前再次检查待提交文件。
3. 将提交身份设为 GitHub noreply 邮箱，避免公开本机 Git 配置中的私人邮箱。
4. 启用仓库 Settings → Pages → Build and deployment → Source: GitHub Actions（或通过 GitHub API 完成对应设置）。
5. 提交并推送 main，检查 Actions 的 Deploy Cyber Aquarium to GitHub Pages 工作流。
6. 工作流成功后，从部署输出取得实际 Pages URL 并检查线上 HTML 与资源响应。

如本机尚未登录，Codex 可启动官方 GitHub CLI 的网页登录流程；用户仅需在 GitHub 页面完成登录和授权，不应把 token 或密码发到聊天中。

目前的本地准备不等于已经创建远端仓库或部署成功。最终网址以 GitHub 返回的 Pages 地址为准；项目站点通常为 https://用户名.github.io/cyber-aquarium/。

## 自动部署流程

配置文件：`.github/workflows/deploy-pages.yml`。

- 触发：push 到 main，或在 Actions 页面手动运行 workflow_dispatch。
- 构建：官方 checkout、Node.js 22，执行 npm run build。
- 上传：actions/upload-pages-artifact 打包 dist，不上传整个项目目录。
- 部署：actions/configure-pages 和 actions/deploy-pages，通过 github-pages 环境发布。
- 权限：源码只读；部署任务额外获得 pages: write 与 id-token: write；不需要自行保存部署 token。
- 同一站点部署串行执行，避免中途取消已经开始的发布。

## 子路径兼容

所有运行资源均使用相对路径：css/、js/、assets/。首页链接为 ./；SVG symbol 使用 #id。没有写死域名、根路径 /assets 或 localhost。

构建检查同时按网站根目录 / 和项目子路径 /cyber-aquarium/ 解析全部静态引用，防止资源意外指向用户名站点的根目录。dist 内包含 .nojekyll，使用 Actions 直接发布产物，不通过 Jekyll 转换。

本地预览器默认在根路径运行；项目子路径还需通过本地模拟挂载与首次线上响应核对。纯静态单页没有客户端子路径路由，不需要 SPA 重写。

## 以后更新

继续让 Codex 修改项目并检查，然后说：“提交并推送到 main，检查 Pages 部署”。推送后 GitHub Actions 自动构建并更新同一个网址，不需要手工上传 dist 或一直运行本机服务器。

如某次工作流失败，查看 Actions 的失败步骤；可由 Codex修复并重新推送。不要强制覆盖远端历史。

主题和数量偏好使用浏览器 localStorage；本机地址与线上域名分别保存设置。没有购买服务器、配置后端或使用 Netlify 的步骤。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
