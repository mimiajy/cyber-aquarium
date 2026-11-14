# 深海氛围音轨

Cyber Aquarium 的 Underwater Ambient 是本项目原创的程序合成音乐与环境音效，源码为 `prototypes/fantasy-reef/audio.js`。没有下载、采样或模仿任何商业歌曲、录音或第三方音频文件，没有运行时 API 和订阅服务。

- 开放排列的 D 小调 add9 和声，柔和正弦合成音色、极缓慢音量/音高/立体声变化。
- 低通水流层与原创混响脉冲，避免刺耳高频和突发声。无强鼓点或突然触发的气泡音。
- 持续振荡器没有文件循环边界；24 秒水流缓冲经过 2 秒重叠渐变以平滑衔接。
- 每次加载默认关闭，不创建 AudioContext。只有点击音乐按钮才创建/恢复音频上下文。保留音量偏好，不保存自动播放偏好。
- 开启约 2.4 秒淡入，关闭约 1.6 秒淡出，调整音量约 0.25 秒过渡；静音后挂起音频上下文以减少耗电。
- 音频与动画循环完全独立，暂停鱼群、沉浸模式和主题切换不会关闭音乐。系统中断音频后可再次点按恢复；实体移动设备可能受系统静音或后台策略影响。

## 来源与授权

仅对本项目的**原创合成音轨、环境音及其原创生成参数**采用 **CC0 1.0 Universal** 公有领域贡献。允许在公开网站免费使用、复制、修改、分发和商业使用，无强制署名。该声明不改变其他代码、图像素材或第三方库的原有权利状态。

To the extent possible under law, the creator has waived all copyright and related or neighboring rights to the original procedural soundscape and sound-generation parameters created for Cyber Aquarium, under CC0 1.0 Universal.

官方授权说明：https://creativecommons.org/publicdomain/zero/1.0/

完整法律文本：https://creativecommons.org/publicdomain/zero/1.0/legalcode.en

实现遵循 Web Audio 用户手势启动规则：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

以后可直接调整 `buildGraph` 的和声、滤波和音量，或更换为已获许可的本地音频。当前实现不需要 MP3/OGG 文件，因此不存在音频文件子路径、失效 CDN 或加载解码等待问题。

## 验证记录

2026-11-15，Safari 原生 OfflineAudioContext 渲染 28 秒、24kHz 双声道、默认 35% 音量：峰值 0.10785、RMS 0.01859，无削波，淡入淡出端点静音，水流环接附近最大逐样本变化 0.00110。完整记录见 `tests/audio-results.json`，本地验证页为 `tests/audio.html`。这些是实际 DSP 输出数据，不是模拟节点结果或主观听感评分。

Safari 实际页面已确认默认静音、手势启动、浏览器音频指示器、音量调整、关闭、暂停/沉浸时独立播放；320px / 390px 窄视口音乐/数量/主控制均在边界内，默认关闭。实体移动设备声音及系统后台策略未单独实测。
