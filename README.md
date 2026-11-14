# Cyber Aquarium

**A little ocean. A little peace.** 一方属于你的梦幻海洋。

[打开 Cyber Aquarium](https://mimiajy.github.io/cyber-aquarium/) · [源码仓库](https://github.com/mimiajy/cyber-aquarium) · [自动部署状态](https://github.com/mimiajy/cyber-aquarium/actions/workflows/deploy-pages.yml)

纯 HTML、CSS、JavaScript 和本地 p5.js 实现。无需后端、付费 API、构建工具或 npm 依赖，运行时没有外部网络请求。

## 在 VS Code 启动

1. 用 VS Code 打开整个 `cyber-aquarium` 文件夹。
2. 选择菜单「终端 → 新建终端」。
3. 执行 `npm start`（需要已安装 Node.js 18 或以上版本；**无需执行 npm install**）。
4. 在 Mac 浏览器打开 **http://127.0.0.1:5173**。
5. 修改代码并保存后，刷新浏览器即可看到变化。终端中按 `Control + C` 停止服务。

另外两种预览方式：

- **VS Code Live Server**：安装扩展后，右键 `index.html` → `Open with Live Server`，保存代码后自动刷新。
- **直接打开**：在 Finder 中双击 `index.html`，即可离线体验。部分浏览器对 `file://` 的偏好存储有限制，使用本地服务更稳定。

如果 5173 端口已被占用，执行 `PORT=5174 npm start`，然后打开 http://127.0.0.1:5174。

## GitHub Pages 自动部署

执行 `npm run build` 生成可直接上传的 **`dist/`** 文件夹，无需安装依赖。构建保留原 HTML、CSS 和 JavaScript，不改动视觉或动画。`npm run preview` 可预览该产物；原来的 `npm start` / `npm run dev` 继续用于开发。

GitHub Pages 的配置与更新说明见 [DEPLOY.md](DEPLOY.md)。首次完成仓库和 Pages 设置后，推送到 `main` 会自动运行 GitHub Actions，构建并部署 `dist`。本地执行构建命令不会上传或发布。构建清单保存在 `build-report.json`，`npm run check:dist` 可独立验证产物。

## 第一版体验

- **梦幻海底**：蓝紫水体、柔和光束、浮游微光、气泡、枝状珊瑚，以及缓缓摇曳的多层水草。
- **自然鱼群**：默认 18 条，5 种体态、6 种配色；具有群聚、速度对齐、近距离分离、边界转向和水母避让行为。
- **发光水母**：3 只水母，半透明伞体、呼吸脉动、独立摆动的细长触须。
- **点击投喂**：点击水中，或按投喂按钮 / `G` 键。附近的小鱼会寻找食物、加速靠近并吃掉它。食物会慢慢下沉并消失。
- **指尖微光**：移动鼠标留下轻微粒子；点击产生柔和涟漪。支持触屏轻点和拖动。
- **两种主题**：日间海洋 / 霓虹深海，平滑过渡；主题和鱼群数量保存在本地。
- **控制**：暂停、恢复、10–30 条鱼的数量调整、全屏、互动指南。

快捷键：`空格` 暂停 / 恢复，`G` 投喂，`F` 全屏，`Esc` 关闭指南。控件获得焦点时，键盘遵循控件原有操作。

系统若开启「减少动态效果」，页面初始为暂停状态，可手动恢复。浏览器标签页隐藏时停止绘制，回到页面后恢复。

## 文件结构

```text
index.html                  页面内容、控制面板、互动指南
css/style.css               布局、主题界面、移动端适配
js/core.js                  数学、配色和绘制小工具
js/creatures.js             Fish / Jellyfish：行为与外观
js/environment.js           水体、光束、珊瑚、水草、气泡
js/aquarium.js              p5 实例、场景生命周期、投喂、粒子
js/ui.js                    控件事件、偏好存储同步、快捷键
assets/vendor/p5.min.js     本地 p5.js 1.11.3
server.mjs                  仅用于本地预览的静态文件服务
scripts/check.mjs           语法、静态资源和模拟行为检查
```

所有脚本按顺序加载，挂载于 `window.CyberAquarium`；未使用 ES module，便于直接双击 HTML。添加生物时，可参照 `creatures.js` 的 `update(dt, world)` 和 `draw(ctx, neon)` 接口，并在场景中注册。`dt` 使用秒，速度以逻辑像素 / 秒计。

## 实现说明

画面全部实时绘制，没有背景照片或预渲染视频。p5.js 管理 Canvas 与动画循环，原生 Canvas 2D 绘制渐变和曲线。静态光束、珊瑚与地形使用离屏缓存；高分屏像素密度限制在 1.5，粒子和食物有数量上限。鱼群在当前 10–30 条范围内使用直观的成对邻域计算，便于阅读和改动。

执行 `npm run check` 检查脚本语法、资源引用，以及固定步长下的鱼群分离、追食和暂停行为。实际帧率依设备、分辨率和浏览器而异。

第三方库：p5.js 1.11.3，LGPL-2.1。原始压缩文件保留版权声明，详见 [p5.js 项目](https://github.com/processing/p5.js) 与 `assets/vendor/p5.LICENSE.txt`。实例模式参考：[p5 官方文档](https://p5js.org/reference/p5/p5/)。
