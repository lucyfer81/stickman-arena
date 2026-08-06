# Stickman Arena — 开发笔记

一款纯前端 2D 火柴人格斗游戏。Phaser 3 + 原生 ES Modules，无构建步骤，可直接部署 GitHub Pages。

## 技术栈与关键决策

- **引擎**: Phaser 3.80.1，本地打包在 `assets/lib/phaser.min.js`（无运行时 CDN，满足"静态、无运行时网络请求"）。
- **入口**: `index.html` 加载本地 Phaser + `js/main.js`（ES module）。所有路径用相对路径，适配 GitHub Pages 项目页。
- **缩放**: `Phaser.Scale.FIT`，设计分辨率 1280×720，居中。横屏为主；竖屏在触屏窄屏下显示"请旋转设备"提示。
- **美术**: 全部程序化绘制。火柴人用 `Phaser.GameObjects.Graphics` 画骨架（脊柱/头/四肢），动画用过程函数（idle 呼吸、run 正弦摆臂摆腿、jump 蜷腿、punch/kick 前伸、hurt 后仰、death 旋转倒地）。无任何外部图片。
- **音频**: WebAudio 程序化合成（方波/锯齿/三角 + 白噪声 + 包络），包含拳、踢、命中、重击、跳跃、落地、敌人死亡、UI、连击升调、波次提示、Game Over 下行音阶。
- **测试**: Playwright。桌面 + 移动横屏 + 移动竖屏三个 project。

## 架构

```
index.html
js/
  main.js                 Phaser 配置、场景注册、音频单例
  config.js               常量（尺寸/重力/玩家/敌人/攻击/颜色）
  scenes/
    BootScene.js          生成 'dot'/'spark' 纹理
    TitleScene.js         标题、演示火柴人、最高分、开始
    GameScene.js          战斗主循环、波次、连击、粒子、屏震、顿帧
    UIScene.js            HUD（血条/分数/波次/连击）+ 触摸摇杆与按键 + 横幅 + 浮字 + 暂停
    GameOverScene.js      结算、最高分、重开
  entities/
    Stickman.js           过程化骨架渲染基类 + 各状态姿势函数
    Player.js             玩家：物理、状态机、拳/踢判定盒、受伤无敌、死亡
    Enemy.js              敌人：3 种变体（grunt/runner/brute）、AI 追击与攻击、死亡
  systems/AudioManager.js 程序化音效
  utils/
    math.js               工具函数（lerp/ease/pulse/aabb 等）
    background.js         背景（渐变天、远景天际线窗户、地面、霓虹边线、暗角）
assets/
  lib/phaser.min.js       本地 Phaser
  svg/favicon.svg         站点图标（也是 SVG 资产）
tools/                    QA 辅助（imgstat/ascii 分析截图，因为我无法直接看图）
tests/                    Playwright 测试 + 截图
```

## 操作

- 键盘: A/D 或 ←/→ 移动，W/Space 跳跃（支持短跳/长跳、土狼时间、跳跃缓冲），J 拳，K 踢，ESC 暂停。
- 触屏: 左下虚拟摇杆（模拟量），右下 JUMP/PUNCH/KICK 按钮。多点触控（addPointer）。
- 攻击会自动朝向最近敌人或输入方向。

## 战斗手感（Game Feel）

- 顿帧（hit pause）：命中瞬间短暂冻结，重击更长。
- 屏震（camera shake）：命中/击杀强度递增。
- 命中火花（线条星芒）+ 粒子爆裂（玩家拳头发光、敌人死亡大爆裂）。
- 连击窗口 2.2s，连击越高分数倍率越高，连击数居中放大显示，每次命中浮字 +分数。
- 敌人受击白闪、击退、浮空。
- 玩家受伤无敌闪烁。

## 已修复的 Bug

1. UIScene 里把 `this.game`（Phaser 内置指向 Game 实例）覆盖成了 Game 场景引用 → 改名 `this.gameScene`。
2. `refreshTouchVisibility` 用了不存在的 `this.game.device` → 改 `this.sys.game.device`。
3. `this.tweens.timeline` 在该 Phaser 构建里不是方法 → 用链式 `tweens.add` + delay 重写横幅动画。
4. **键盘拳/踢/跳根本没生效**：`_setupKeyboard` 只 `addKey` 了 J/K/Space，却从没把按键事件写到 `controls.punchPressed/kickPressed/jumpPressed`。补上 `key.on('down', ...)` 边缘触发。这是最关键的玩法 bug——修复后桌面端才能打出伤害。
5. Stickman `seg2` 收到的是姿势 key 字符串，但 `P()` 期望点对象 → 改为 `pose[ka]` 查表。

## 视觉打磨（第二轮）

- 火柴人加粗（线宽 6→7）、加 **暗色描边底层** 让其在背景上更跳、加 **躯干辉光**、加 **朝向眼睛**、拳头命中时高亮放大。
- 背景重做：渐变天 + 星点 + **月亮辉光** + 远景天际线（带亮窗）+ **透视地面网格** + 加粗霓虹边线/墙线 + **环境飘浮余烬粒子** + 顶部暗角。画面非空率从 1.1% 提升到 ~8%。
- 顿帧、屏震、命中粒子、连击浮字、击杀 **慢动作（0.35x × 0.18s）**、落地扬尘 + 轻微屏震、K.O. 浮字。

## 测试可观测性

- 向 `window.__stickman` 暴露遥测（state/score/wave/combo/health/敌人数）。
- 向 `window.__controls` 暴露控制对象，向 `window.__test` 暴露 `setHealth/hurt/killEnemies` 用于加速测试。
- 因无法直接看图，写 `tools/ascii.py` 把截图转彩色 ASCII（#白/C青/R红/Y黄/G绿/P紫）人工"看"画面，`tools/imgstat.py` 算非空率与色块统计。

## 测试环境备忘

- 沙箱无 sudo，Chromium 缺 libatk 等系统库。从 Ubuntu 内部镜像 `mirrors-internal.cmecloud.cn` 用 `tools` 解出闭包 .deb 到 `~/.local/chromium-libs`，跑 Playwright 时设：
  `LD_LIBRARY_PATH=/home/ubuntu/.local/chromium-libs/usr/lib/x86_64-linux-gnu:/home/ubuntu/.local/chromium-libs/lib/x86_64-linux-gnu`
- 因无法直接查看图片，用 `tools/ascii.py` 把截图渲染成彩色 ASCII（# 白/C 青/R 红/Y 黄/G 绿/P 紫）来"看"画面布局。
- Playwright webServer 会自起 `python3 -m http.server 8080`。

## 里程碑日志

- 2026-08-06: 搭建完整 MVP——标题、战斗、3 种敌人、波次推进、连击、粒子、屏震、顿帧、移动触摸控制、Game Over、最高分。桌面 4 项 Playwright 测试通过。
