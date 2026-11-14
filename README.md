# Cyber Aquarium

**微光生长的地方。** 一片会呼吸的幻想海洋。

[打开水族馆](https://mimiajy.github.io/cyber-aquarium/) · [源码仓库](https://github.com/mimiajy/cyber-aquarium) · [自动部署](https://github.com/mimiajy/cyber-aquarium/actions/workflows/deploy-pages.yml)

风格化半写实奇幻海洋：三种自然鱼群、两只发光水母、丰富的珊瑚海葵、柔和光束和浮游微光。原生 HTML / CSS / JavaScript、Canvas 2D 与 WebGL 连续贴图形变，无后端、付费 API、运行时外部请求或 npm 依赖。

## 在 VS Code 启动

1. 打开整个 `cyber-aquarium` 文件夹。
2. 在终端运行 `npm start`（Node.js 18+，无需 `npm install`）。
3. 浏览器打开 **http://127.0.0.1:5173/**。
4. 修改源文件、保存、刷新即可；`Control+C` 停止服务。

端口已占用时，沿用已有服务，或运行 `PORT=5174 npm start`。也可使用 VS Code Live Server。推荐 HTTP 预览，确保浏览器可以读取 WebGL 素材。

## 体验与声音

- 默认 18 条鱼，10–30 总量可调：蓝绿礁鱼、荧光灯鱼、长鳍神仙鱼，独立形态、游速和社交特点。
- 点击水中或按 `G` 投喂，鱼群自然聚散、避让并追食。
- 日间 / 深海主题、暂停 / 恢复、内部微光和纯净观赏；数量与视觉偏好保存在本地。
- 点按 **开启氛围** 聆听原创 Underwater Ambient：柔和和声、缓慢空间变化与轻微水流。**每次进入默认静音**，音量滑块独立控制并记忆音量；开启/关闭柔和淡入淡出。
- 音乐持续无文件循环断点，暂停动画或进入纯净观赏时仍可播放；再次点按音乐按钮关闭。沉浸模式下按 `H` 或“显示界面”即可找回控制。

快捷键：`空格` 暂停 / 恢复、`G` 投喂、`H` 纯净观赏。控件聚焦时保留原生键盘行为。支持触屏；系统减少动态效果时初始暂停画面。后台停止绘制，声音独立并受浏览器/系统后台策略约束。

## 检查与构建

```bash
npm run check
npm run check:audio
npm run check:reef
npm run build
npm run check:dist
PORT=5174 npm run preview
```

`npm run build` 自动运行原有检查、当前鱼群/渲染与音频控制测试，按明确清单复制最新场景到 `dist/`，检查网站根路径及 `/cyber-aquarium/` 项目子路径。产物不包含开发工具、凭据、旧美术素材、QA 图、测试或性能基线。构建本身不会上传网站。

本地提交并 Push 到 `main` 后，GitHub Actions 自动构建并部署同一网址，详见 [DEPLOY.md](DEPLOY.md)。以后可直接让 Codex“修改并测试，然后提交推送 main，检查 Pages 部署”。不要直接编辑 `dist/`。

## 代码位置

| 文件 | 用途 |
| --- | --- |
| `index.html` | 唯一正式页面和控制界面 |
| `prototypes/fantasy-reef/style.css` | 既有视觉样式及响应式控制 |
| `prototypes/fantasy-reef/app.js` | 页面事件、设置、主循环与共享脚本资源路径 |
| `prototypes/fantasy-reef/fish-school.js` | 三鱼种 Boids、平滑转向、追食 |
| `prototypes/fantasy-reef/scene.js` / `warp.js` | 分层合成、缓存与动态图集形变 |
| `prototypes/fantasy-reef/audio.js` | 原创音轨合成与独立音乐控制器 |
| `prototypes/fantasy-reef/assets/` | 六张当前绘画素材 |
| `scripts/runtime-files.mjs` | 正式发布运行文件清单 |
| `server.mjs` | 仅本地使用的静态预览服务 |

保留 `prototypes/fantasy-reef/` 目录名以避免挪动已验证的场景和素材；其中旧 `index.html` 自动跳转正式首页。早期 p5 版本的代码和许可证保留在 Git 历史/原目录中，不作为当前首页运行或打包第三方 p5 库。

当前场景使用批量 WebGL 图集、缓存光晕与真实时间小步更新；鱼种、素材、DPR 上限和环境元素数量未削减。性能记录见 [PERFORMANCE_REVIEW.md](prototypes/fantasy-reef/PERFORMANCE_REVIEW.md)。

音频全部本地原创合成，无商业采样；原创音轨及生成参数采用 CC0 1.0，无强制署名，详见 [AUDIO.md](AUDIO.md)。该声明不改变图像、其他代码或历史第三方库的权利状态。
