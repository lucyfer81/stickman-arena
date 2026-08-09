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

## Round 3 — 趣味导向：Boss 波（高潮遭遇战）

游戏功能已完备且稳定。以独立游戏设计师视角做了一次"纯趣味"审计：
最致命的趣味杀手是**结构性**的——每一波形状相同，wave 7 只是"放大数字的
wave 1"，没有任何峰值/高潮。补救方向是在每 5 波插入一个高潮 Boss 遭遇战。

### 改动
- **Boss 变体**（`Enemy.js` + `CONFIG.BOSS`）：大火柴人（scale 1.6）、220 基础血
  （随波次+难度缩放）、120 攻击距离。独有的**下砸（slam）**特殊攻击：
  0.7s 蓄力预警（拳头辉光渐亮）→ 向玩家方向跃起 → 落地时向左右各发射一道
  沿地面传播的**冲击波**。落地期间全程超甲（无法被打断），唯一对抗手段是**跳过
  冲击波**（双脚离地 ≥34px 即可穿过）——这给"踢spam"最优解之外强加了一个新决策。
- **狂暴阶段**：血量 ≤50% 触发一次——速度+25%、攻击性+20%，并召唤 2 个 grunt，
  横幅 "THE BOSS IS ENRAGED!"。
- **Boss 波规则**（`GameScene.startWave`）：`n % 5 === 0` 为 Boss 波，只刷 1 个
  Boss（无杂兵），红色 "BOSS WAVE N" 横幅 + 屏震。
- **冲击波实体**（`GameScene.spawnShockwave/_updateShockwaves`）：地面波纹（红/金/橙
  弧线 + 前沿竖墙），撞墙或超时消失；仅命中贴近地面的玩家。
- **击杀回报**：Boss 死亡走 0.5s 慢动作 + 0.18s 顿帧 + 强屏震 + 60+40 粒子爆裂 +
  "BOSS DOWN! +1500" 横幅 + 浮字 + 必掉血包。是整局最强烈的反馈峰值。
- **Boss 血条**（`UIScene`）：顶部贯穿式红/金血条，<50% 显 "ENRAGED"。
- 提取 `_applyScaling(e,n)` 共享波次/难度缩放（普通怪/Boss/召唤物统一）。

### 验证（趣味代理指标，非主观感受）
- 官方 CI 套件 5/5 绿（桌面×3 + 移动横/竖）。
- 新增 `tests/boss.spec.js` 3/3 绿：① Boss 在 wave 5 刷出（血量>150、血条在），
  真实战斗管线击杀触发 +1500 分 + 必掉血包 + 波次清场；② 下砸会发冲击波，站桩玩家
  被命中（hitsTaken↑）；③ 持续跳跃可清过冲击波（10s 内<6 次命中）。
- Hardcore 角色 90s 长跑无报错，Boss 遥测字段全部正常流通。
- ASCII 抓帧确认画面：大火柴人 Boss + 顶部红血条 + 地面冲击波弧线均可见。

### 趣味评估（设计推理）
| 维度 | 改前 | 改后 |
|---|---|---|
| 高潮峰值 | 无（曲线扁平） | 每 5 波一场 Boss 决斗 + 慢动作回报 |
| 故事性 | "打到 wave N" | "残血击杀 wave 5 Boss" |
| 即时决策 | 踢spam 最优 | Boss 波必须跳冲击波 |
| 结构多样性 | 每波同形 | Boss 波打破节奏 |
| 流失点风险 | 3-4 波后腻 | wave 5 有明确目标在前 |
诚实保留：趣味是结构性/机制性代理指标，无法替代真人手感；单种 Boss 视觉在
wave 15+ 后可能重复，后续可加 Boss 种类。另两个候选（拳/踢差异化、残血狂暴）留作下一轮。

### Round 3b — 战斗深度：拳/踢剪刀石头布

Boss 解决了"峰值"，但**普通波战斗仍单调**——踢全程碾压拳（9 vs 16 伤，DPS 也低），
最优解是踢spam。这轮给每一秒战斗加决策。

改动：
- **拳伤 9→11**：拳 DPS（≈35.5）追平踢（≈34.8），不再被碾压；拳低单发、低击退但安全。
- **拳→踢取消**：拳挥出期间按踢可无缝接踢（混招奖励），把乱按变成可读的连段节奏。
  踢是承诺技，不可被取消。
- **踢空挥惩罚**：踢的活跃窗结束若未命中，后摇从 0.26→0.42s（`RECOVER_WHIFF`）。
  盲踢会被躲闪的 runner 惩罚；命中的踢照常快回。`attack.connected` 由 `_resolveCombat`
  在命中时置真，驱动空挥判定。

验证（`tests/depth.spec.js` 3/3）：① 拳命中固定假人扣 11 血；② 空挥踢 `total`=0.62 >
命中踢 `total`=0.46（+0.16s 后摇，确定性读 attack.total 而非挂钟）；③ 按拳后按踢，
在挥击窗口内进入踢（旧代码会丢弃该踢输入）。
官方 CI 5/5 + Boss 3/3 全绿，未破坏既有平衡。

趣味评估：这轮杠杆在于改善**所有波**的**每一秒**战斗（含 Boss 波），正面攻破硬核
"踢spam=游戏已解"。拳/踢/取消三者形成：拳=安全起手+连段胶水（克快 runner）、
踢=重击+控距+风险（克慢 brute、Boss 回复窗）。仍是代理指标；下轮候选=残血狂暴。

### Round 4 — 首分钟留存（onboarding / 奖励节奏 / 进度感）

假设玩家只玩 60 秒，攻新手+休闲的首分钟流失。设计文档见
`docs/superpowers/specs/2026-08-07-first-minute-retention-design.md`。

流失诊断（CONFIG 推演 + DESIGN.md persona 遥测）：①死时间（敌人墙边→中场 ~3.2s）
②无威胁（casual 60s 满血）③引导只标注不教学（AFK 30s 仅掉 36 血看不懂）④最爽内容
后置（boss/skins 首分钟全摸不到）⑤元进度局内不可见。

五项改动：
- **死时间**：wave1–3 出生点内移到距中场 ±280px 固定带；前3波波间 1.1→0.7s、出生间隔
  (0.3,0.65)→(0.22,0.45)；wave1 首敌 spawnTimer 0.3→0.15。首接触 ~3.2s→~1.5s。
- **早期施压**：`_applyScaling` 的 aggrMul 加 `Math.max(0.95, …)` 下限（原 floor 0.8）。
- **教学引导**：UIScene 新 teach 层——首敌接近头顶箭头+"J/PUNCH"、残血"K/KICK 收割"、
  AFK 兜底大字提示；GameScene 加 `onboard.firstHit`。保留桌面芯片。
- **首分钟高潮**：当局限首杀（非 boss）→"FIRST BLOOD"横幅+慢镜0.3s；新变体 **vanguard**
  （金、1.25×、50hp）仅 wave2 首刷，6–8s 小决斗。
- **进度可见**：`Meta.nextUnlock` + HUD 目标条（滚动显示下一未解锁皮肤）+ 结算页
  "明日 daily"与进度条。

红线：boss 仍 wave5；难度/skins/daily 逻辑不改。新增 `tests/retention.spec.js`。
本环境无浏览器系统库跑不了 `npm test`，已按构造保证不破坏现有断言。

**实现完成**：6 文件改动，全部 `node --check` (ESM) 通过。
- `config.js`：新增 `RETENTION` 调参块。
- `Enemy.js`：新变体 `vanguard`（金、1.25×、50hp、score 300）。
- `Meta.js`：`nextUnlock(stats)`（按 ember→toxic→gold→royal 返回首个未解锁+进度）+ `dailyModifierTomorrow()`。
- `GameScene.js`：wave1–3 内移带出生/早波波间 0.7s/早波出生间隔 (0.22,0.45)/wave1 首敌 0.15s；aggrMul 早波 floor 0.95；首杀 FIRST BLOOD；wave2 首刷 vanguard；`onboard.firstHit`；`spawned/counts` 加 vanguard；遥测加 `firstBlood`；新增 `__test.killFirstEnemy` 钩子。
- `UIScene.js`：teach 层（首敌头顶箭头 J/PUNCH、残血 K/KICK、AFK 兜底大字，touch/desktop 自适应，限 wave≤2 且首命中前）+ HUD 目标条（`Meta.nextUnlock`，随波次刷新）。
- `GameOverScene.js`：结算页加"下一解锁进度"与"明日 daily"两行（放 yy 统计列，避开尸体）。
- 测试：`tests/retention.spec.js`（5 用例：内移带/墙边、vanguard 仅 wave2 首刷、FIRST BLOOD 仅一次、nextUnlock+明日、teach/goal/结算 smoke），并在 `tests/dev.config.js` 注册 `retention` project。CI `npm test`（core/mobile）不受影响。

验证缺口（需你环境补跑）：`npx playwright test --config=tests/dev.config.js`（retention + 全部 dev 套件）与 `npm test`（官方 5/5）。

### Round 5 — 内容多样性（敌人 / 遭遇 / 稀有事件 / 环境交互）

攻"游戏重复感"。**只加内容，不改系统架构**——所有新机制都复用现有模式（变体字典、
shockwave 数组、Pickup 实体、mods 总线、banner/slowmo 反馈原语）。本环境已补齐 Chromium
系统库（`apt-get download` 18 个 .deb 到 `/tmp/opencode/chromelibs` + `LD_LIBRARY_PATH`），
故全部测试首次可在本机实跑。

**4 类新内容：**

1. **敌人多样性**（`Enemy.js` VARIANTS + 专属 AI 分支）：
   - **shielder**（钢蓝、55hp、持盾）：正面挡轻击（拳 kb≤400 从正面 0 伤害+clang 火花）；
     踢（heavy kb>400）破盾 ~1.1s 惩罚窗；背刺受伤。教玩家混踢+绕侧。
   - **bomber**（橙红、18hp、自爆）：冲到玩家近前（78px）或存活>4.5s 点燃 0.6s 引信，
     引信期白热频闪+加速冲；死亡或引信到时 `_detonate`→`_detonateBomber`：半径 96px 爆风
     （击退+对玩家接触伤害）+ 链式伤害其他敌人（友好火力）+ 3.2s 地面火区。引信可被击杀
     提前引爆=clutch 连锁。`detonated` 标志保证只爆一次。
   - **ranger**（品红、26hp、远程）：保持 KITE_RANGE 320，60px 外抛物线投掷（弹道求解
     `spawnEnemyProjectile` 按 T=dist/520 clamp(0.55,1.3) 解 vx/vy），被贴近则 retreat。
     纯远程；抓住=免费击杀，逼玩家主动近身。

2. **环境交互**（`GameScene` 两个新数组，复用 shockwave 的 update+draw 模式）：
   - **hazards**（地面火区）：bomber 爆炸/meteor 火印遗留，0.5s tick 对站立其中的玩家+敌人
     造持续伤害（敌人=友好火力链）；`fireLayer`(depth18) 多层火焰绘制。
   - **projectiles**（ranger 投掷物）：重力抛物线，落点尘爆；`projLayer`(depth20) 光球+尾迹。
   - **meteorWarnings**（meteor 事件）：0.7s 地面圆环预警+下落岩石，命中=爆风+短暂火区。

3. **遭遇/稀有事件**（新 `js/systems/Events.js`，对标 Meta.js 字典+纯函数）：
   `rollEvent(wave)` 在非 boss 波（wave≥3）以 20% 概率选一个事件，`apply(scene)` 设标志位，
   `spawnOne`/`update` 据此混搭当波。8 个事件：SWARM（全 runner+3）、HEAVY（brute/shielder
   -1）、BOMB SQUAD（全 bomber）、HUNTER PACK（ranger/leaper）、ELITE DUO（前 2 个 vanguard）、
   SUPPLY DROP（空投 gold+rage 拾取物）、METEOR STORM（波期间陨石）、RAGE MODE（免费 rage
   ×1.6 时长）。boss 波从不事件化；wave1 仍纯 grunt、wave2 仍 vanguard 首刷（retention 约定）。

4. **拾取物多样性**（`Pickup.js` 加 `type`）：health（原有青十字 +25hp）/rage（橙闪电，8s
   ×1.6 伤害+×2 计分，HUD 加橙色 rage 条）/score（金宝石，+500×scoreMul）。空投用 `{drop:true}`
   从天而降。非 boss 击杀 4% 概率掉 rage。

**配套：**`_scoreMul()` 统一 difficulty×daily×rage 计分倍率；`_resolveCombat` rage 期放大玩家
伤害；HUD rage 条（UIScene）；`spawned/counts`/遥测加 shielder/bomber/ranger + hazards/
projectiles/meteors/rage/event；新增 `__test` 钩子（spawnVariant/triggerEvent/giveRage/
dropPickup/spawnFireZone/spawnProjectileAt/detonateAt）。

**回归修复：**`_physics` 加通用 `_hardSeparate`（minGap12，仅严重重叠时触发，跳过 boss 目标）
+ bomber/ranger `_sepNudge`（含 d≈0 的 id-parity 确定性分流），保证 ">8px 不完美重叠" 不变式
（qa-regression 在 bomber/ranger 绕过 flank 槽位后曾偶发破坏）。`killFirstEnemy`/`killBoss`
钩子末尾加 `_updateHUD()` 同步刷新遥测，修掉 FIRST BLOOD 断言的陈旧读取（原代码在本环境也失败）。

**测试：**新增 `tests/variety.spec.js`（10 用例，覆盖 3 变体+火区/投掷物+rage/score 拾取+
事件导演+meteor），注册 `variety` project。官方 CI 5/5 + 全 dev 套件（boss/depth/combo/
difficulty/meta/onboard/qa/retention/variety/volume）全绿。playthrough 实测中 casual 触发
supply 事件+收集 rage、mobile 触发 swarm 事件（5 runner），新内容已在真实对局出现。

**趣味评估：**这轮杠杆是让每波都可能不一样——同一波可能是蜂拥/重甲/炸弹/猎人/精英/陨石/
狂暴/空投，加上 3 种逼迫不同应对的新敌人（盾=踢、爆=拉距、射=近身），重复感显著下降。
仍是代理指标；下轮候选=把事件/新变体接入 meta 解锁或 daily 池。

### Round 6 — 游戏手感（juice pass，纯反馈增强，零新机制）

攻"打击满意度"。**只调反馈层，不动任何机制/伤害/时序**——所有改动复用既有事件入口
（_onPlayerHit/_onPlayerHurt/_slamImpact/_detonateBomber 等），不新增攻击/敌人/系统。
约束：depth 套件锁定的伤害(11/16)与攻击时序(total 0.46/0.62)一字未改。

**新增 FEEL 调参块（`config.js`）**：ZOOM / SHOVE / RING / PAUSE 四组可调常量。

**7 维手感改进：**
1. **相机 punch-zoom**（最大缺口——之前相机 100% 静止）：命中瞬间 `camBoost` 跳到峰值，
   指数缓回（TAU=0.075s），`zoom = 1 + boost`。事件分档：HIT 0.018 / HEAVY 0.034 /
   HURT 0.030 / KILL 0.050 / BOSS_KILL 0.095。硬上限 0.12 防眩晕。顿帧期间保持峰值不衰减。
2. **方向后坐（camera shove）**：命中时相机沿打击反方向横移几 px（HIT 4 / HEAVY 8 /
   KILL 12 / BOSS 18），向下砸击（boss 落地/bomber/陨石）加 +Y 下压 shove 卖重量。
   位移钳制在 zoom 余量内 → 永不露出世界边缘。
3. **冲击波环（`ringLayer` depth 21）**：命中点扩散光环（ease-out 半径 + 后半淡出 +
   开帧内辉光盘），分档 maxR 46→170。顿帧期间继续扩张 → 冻结帧上光环划过=经典 impact tell。
4. **粒子加重力**：hitEmitter `gravityY:720` 让火花/碎片抛物下坠（远比漂浮点有分量），
   speed 160-560、数量 14→18、scale 0.85。dustEmitter 加 gravityY:360。重击/击杀数量上调。
5. **方向火花**：`_spark` 改为沿打击方向 ±55° 扇形（7 条）+ 白热核心圆盘 + 2 条白尖
   crackle，clear 延长 60→85ms。无方向时退化为全向。
6. **屏震调脆**：普通命中 0.006→0.009、重击 0.014、受伤 0.020、bomber 0.024（强度上调、
   时长略短=更"脆"）。
7. **预备动作（视觉，不改时序）**：玩家 windup 期间拳头辉光从 0.25 渐亮到 0.85（"蓄力"读
   感），active 期=1，recover 衰减。敌兵 windup 已有渐亮，保留。
8. **顿帧补强**：重击命中 +0.020s、击杀 +0.035s 叠在攻击 base HIT_PAUSE 之上（卖"分量"）。

**接入的大事件**：玩家命中/受伤/击杀/Boss 击杀、Boss 落地砸击(slam)、Boss 狂暴、
bomber 爆炸、陨石落地、shielder 格挡 clang、玩家硬落地（>720px/s 触发小环+zoom）。

**验证**：
- 官方 CI 5/5 绿（desktop×3 + mobile 横/竖），错误收集型断言零 runtime error。
- dev 全套件绿：depth 3/3（伤害 11、whiff 0.62>connect 0.46、cancel 通）、boss 3/3、
  combo 1/1、variety 10/10、retention 6/6、onboard 1/1、qa 7/7、difficulty 1/1、
  meta 3/3、volume 1/1 —— 共 36 项全过。
- ASCII+imgstat 抓帧确认：punch 帧黄色火花粒子 4174 像、boss 击杀帧红色爆发 7886 像，
  方向火花条纹/扩散环/粒子风暴均可见，无报错。

**趣味评估**：这轮不动结构，只让每一次命中都"更有劲"——相机终于会动了（punch-zoom+后坐）、
命中点有扩散环、火花有方向且下坠、重击/击杀的顿帧与缩放峰值递进。Boss 击杀从"大爆炸"
升级为"大爆炸 + 最大缩放 + 下压后坐 + 双层光环"。仍是代理指标（无真人手感），但覆盖了
用户点名的全部 7 维（命中效果/屏震/冲击反馈/粒子/预备/攻击时机/相机运动）。

### Round 7 — 记忆点机制：Second Wind「破碎」（唯一的"意外"机制）

以创意总监视角：游戏已稳、已 juice，缺的是**玩家会主动讲给别人听**的意外瞬间。
不做通用功能（额外命/复活币太常见）。目标是颠覆格斗游戏最核心的预期——**0 血=死亡**。

**机制：Second Wind「破碎」——每局一次，0 血不灭。**
- 玩家血量归 0 时，**不立即死亡**（每局仅一次）。火柴人**碎裂**：右臂脱落成物理残肢
  飞出落地，画面去饱和泛红边晕，心跳脉动。
- 进入 **6 秒「破碎」窗口**：1 血（再挨一下即死）、伤害 ×2、移速 ×1.3——孤注一掷的反扑。
- 窗口内每杀一敌：**计时器 +1.2s** 且 **55% 概率掉血包**。
- 拾取血包 = **「重塑」(REFORM)**：手臂秒回、色彩回流、血量回到 40%、慢镜、
  "REFORMED!"横幅、+750 分。局继续。
- 计时器归零 或 窗口内挨打 = 真死。
- `secondWindUsed` 保证每局只触发一次——是珍贵的故事瞬间，不是拐杖。

**为何"意外/可记忆"而非通用**：①颠覆"0 血即死"这个承载性预期；②断臂+接回的视觉**只有
火柴人能做**（线条会散开/拼回，把美术风格用到了骨子里）；③"残血断臂单挑 boss 后捡血重塑"
是会发群的瞬间；④每局一次保持稀缺性，永远是故事而非套路。

**改动（复用现有系统，新增面极小）：**
- `config.js`：新增 `LASTSTAND` 调参块（时长/击杀延时/掉血概率/伤害移速倍率/重塑血量分数/入场无敌）。
- `Player.js`：`broken`/`brokenT`/`secondWindUsed` 状态；`takeHit` 致死分支路由到 `_enterBroken()`
  （而非 `die()`）；`update` 计时器归零→真死；移速倍率；`_render` 设 `limbMask.dropRightArm`。
- `Stickman.js`：`render` 支持 `limbMask`——破碎时跳过右臂两段线/肘关节/右拳绘制（视觉"断臂"）。
- `GameScene.js`：`_onEnterBroken`（碎裂反馈峰值：慢镜+顿帧+双层环+最大缩放+下压后坐+残肢prop+
  保底血包 lifeline+"SECOND WIND!"横幅）；`_reform`（金色回流：慢镜+环+缩放+双色粒子+
  "REFORMED! +N"横幅）；`_updateDebris`（残肢物理+绘制）；`_updateVeil`（去饱和+红色边晕+心跳）；
  `_resolveCombat` 伤害倍率叠加 broken；`_onPlayerHit` 击杀窗口加时+掉血；血包拾取分支→重塑；
  新增 `debrisLayer`(depth9)/`veilLayer`(depth220)；HUD/遥测加 broken/brokenT/secondWindUsed/reformed；
  `__test` 钩子 enterSecondWind/reform/fastForwardBroken。
- `UIScene.js`：底部居中「SECOND WIND」倒计时条（危险段加快脉动+变色）。
- 设计文档：`docs/superpowers/specs/2026-08-07-second-wind-design.md`。

**验证（趣味代理指标 + 视觉确认）：**
- 官方 CI 5/5 绿（desktop×3 + mobile 横/竖）。
- 新增 `tests/laststand.spec.js` 4/4 绿：①致死触发破碎（血=1、secondWindUsed、保底血包、非dying）；
  ②血包重塑（清broken、血>1、加分）；③窗口击杀加时（brokenT 不降反升）；④计时归零→真死→
  gameover；重塑后第二次致死必须真死（每局一次）。
- 新增 `tests/eval-secondwind.spec.js`（eval project）：真实战斗管线致死→破碎→窗口内还手→
  拾血重塑，全程无 error。即机制在真实对局里自然发生。
- 全 dev 套件回归绿（depth3/boss3/variety10/retention5/qa7/combo/difficulty/onboard/meta/volume
  共 34 项）——未破坏既有平衡。
- imgstat 色彩对比确认视觉戏剧性：破碎帧 red=14504 主导（红晕+去饱和）、reform 帧 red=199/
  cyan=12419（色彩回流），即"颜色重新灌入"瞬间由数据可读。

**趣味评估**：这轮攻"记忆点"而非稳定性——制造玩家会截图发群的意外瞬间。破碎→重塑的弧线
把"差点死"变成"差点死然后单臂反杀捡血重塑"的故事。断臂/接回是火柴人专属的视觉钩子。
仍是代理指标（无真人手感）；未来可加：破碎期间的专属动作（头槌/绝望一击）、重塑后的短暂
"完美态"、或把 Second Wind 计数接入 meta 解锁（"曾重塑 N 次"徽章）。

## 上线后模拟（Steam 评价驱动迭代）

假设游戏已发售，写了 20 正面 + 20 负面 Steam 评价（基于真实特性，存于
`docs/post-launch-reviews.md`），归类反复出现的抱怨，定位根因，真实修复。

### Round A — 最常见抱怨：**没有音乐（全程死寂）**
20 条差评里 6 条（30%）点名，且所有玩家都会中招——把游戏最强的"手感"（顿帧/慢镜）放在
死气沉沉的背景里播放。

**根因（源码核实）**：`AudioManager.js` 只有一次性程序化音效（punch/kick/hit…），全仓库
搜 `bgm|music|ambient` 零命中，无任何场景启动过持续音频床——标题、每一波、每个 Boss、每个
Second Wind 瞬间都是纯静音。

**修复**：给 `AudioManager` 加**程序化生成音乐引擎**（沿用"100% 程序化、无外部文件"哲学，
和音效同源）：
- 经典 lookahead 调度器（25ms tick、0.2s 前瞻、精确 AudioContext 时间排程），16 步/小节。
- 四档 intensity，场景事件即时切档：menu（92bpm 琶音+pad）→ combat（126bpm 贝斯+鼓）→
  boss（150bpm 和声小调紧张+密集鼓）→ broken（140bpm 减音阶绝望）。
- 独立 `musicGain` 挂在 master 下：音量/暂停静音自动生效；比 SFX 低一档不抢戏。
- 接入点：Title 启动 menu→start 切 combat；GameScene.create 确保 combat；startWave 按
  boss/普通切档；`_onEnterBroken`→broken；`_reform`→还原；GameOverScene.create stopMusic。
- 遥测：`window.__stickman.music` + `window.__audio.getMusicState()`（on/intensity/bpm）。

**验证**：新增 `tests/music.spec.js` 4/4（菜单/战斗、boss 切档往返、Second Wind 切档+reform
还原、gameover 停止音乐，全程零 error），注册 `music` project。回归：官方 CI 5/5、laststand
4/4、boss 3/3、volume 1/1 全绿（dev 套件中途一次 8 失败为我强杀长命令留下的孤儿进程争用
8080 端口，清掉后单独跑全过，非代码回归）。

### Round B — 修复音乐后，新最常见抱怨：**重复/内容薄（Boss 单一）**
修好音乐后写第二批评价，"没音乐"消失，抱怨分布前移：**重复/太薄 + 只有一两种 Boss** 合并
成新 #1（4/12，且正面评价也在"要更多 Boss"）。本质是同一结构性问题——玩家到 wave 10+ 重复
遇到同样的 Boss。

**根因**：`_spawnBoss` 永远 `new Enemy(...,'boss')`，单一原型单一攻击（下砸）；无第二 Boss
数据、无特殊攻击分支，`isBoss` 仅认 `'boss'`。

**修复**：加第二 Boss「The Oracle」(caster)——
- `VARIANTS.bossCaster`：毒绿、1.45×、200hp。专属特殊技是**预警 0.6s 后抛射弹幕**（3 发/
  狂暴 5 发），复用 ranger 投掷物池（`spawnEnemyProjectile` 加可选 dmg 覆盖）；对抗是走位/
  起跳躲避 + recover 窗口惩罚，区别于 slammer 的"必跳冲击波"。
- **交替**：真实 boss 波按奇偶——wave 5/15/25=slammer、wave 10/20/30=caster；横幅+顶部血条
  显示 Boss 名（THE SLAMMER / THE ORACLE）。
- **变体感知狂暴**：caster 召唤 leaper（防空，惩罚跳躲弹幕）替代 slammer 的 grunt。
- 共享基础设施不变：两 Boss 共用血条/狂暴/超甲/BOSS DOWN 回报（`enemy.isBoss` 对两者均为真）。

**接入要点**：Enemy 构造 `isBoss = 'boss'||'bossCaster'`、`bossKind`、`cast` 状态；armor 分支
含 cast；render 分支含 cast；AI 特殊技按 bossKind 分流（`_startCast/_progressCast/_castRelease`）；
`_spawnBoss` 真实 boss 波按奇偶选、越波调用默认 slammer（向后兼容）；`_bossEnrage` 按
`ENRAGE_SUMMONS_KIND[bossKind]` 选召唤物；HUD/遥测加 bossKind/name + counts/spawned 加
bossCaster；新增 `__test.spawnBossKind/bossFireSpecial` 钩子。

**验证**：新增 `tests/bossvariety.spec.js` 4/4（wave5=slammer/wave10=caster、caster 弹幕生成
投掷物、caster 狂暴召唤 leaper、caster 击杀触发 BOSS DOWN 回报+血包），注册 `bossvariety`
project。回归修复：重构初版让越波 `spawnBoss()` 钩子误选 caster（wave1→bossIndex0 偶），破坏
slammer 冲击波测试；改为"真实 boss 波按奇偶、越波默认 slammer"后，官方 CI 5/5 + boss 3/3 全绿。

**趣味评估**：两 Boss 形成不同节奏的剪刀石头布——slammer=读条跳冲击波、caster=读条躲弹幕+
近身惩罚。仍是代理指标；下轮候选=第三 Boss（冲锋型）或把 Boss 模组化（随机附加词缀）。

## Round 8 — 美术总监审查：标题屏（"商店橱窗"重塑）

以美术总监视角做发布前全场景审查（标题/战斗/Boss/破碎/Game Over/移动横屏/竖屏）。逐场景用
Playwright 抓帧 + ASCII/imgstat "看"画（模型不支持图像输入，沿用 tools/ascii.py、imgstat.py）。

**结论：最伤玩家感知的是标题屏。** 它是每个玩家第一眼、是卖游戏的截图，却有三个问题：
1. **中段空洞**——标题在顶(y170)、6 行文字挤在底(462–656)，中间 y≈270–450 是约 180px 高的
   全空白带（画面非空率仅 9.7%）。
2. **构图失衡**——demo 火柴人孤零零站在左侧(cx-220)，右侧空荡。
3. **底部拥挤**——daily/难度/皮肤/PRESS SPACE/控件/移动提示 6 行扎堆 200px，CTA 被淹没。
游戏内场景已过 6 轮打磨、信息密度高；标题是唯一没碰过、最弱的环节。按"玩家感知优先"为最高杠杆。

**修复（`TitleScene.js`，纯视觉/布局，零机制改动）：**
- **居中"对峙"双人 demo**：单个左侧火柴人 → 玩家(cx-150,青) vs 敌人(cx+150,红) 居中对峙，
  facing 相对；`update()` 改为 3.4s 轮换出拳的陪练循环——直接呈现"火柴人竞技场"的承诺。
- **舞台聚光灯**（新 `_buildSpotlight`，ADD 混合、低 alpha、depth -30）：cyan 光锥 + 地面光池
  锚定中央。锥顶定在选择器下方(y392)，**只照亮 CTA+决斗区**，菜单文字留在干净暗板上。
- **菜单上移填空**：daily 462→320、难度/皮肤选择器 520→364（同步更新 diffRect/skinRect/dailyRect
  命中区），把功能性内容从底部拥挤区拉进原空白带。
- **CTA 成主角**："PRESS SPACE/TAP" 570→458，字号 30→34，加描边+投影，独占呼吸带。
- **底部松绑**：控件提示 624→672、移动提示 656→698，压到最底边。
- 标题 170→150、tagline 246→220、BEST 300→276（整体上移让位）。

**验证：**
- 截图对比（imgstat）：中段非空率 **9.7% → 18.4%**；新增 red=1724(敌人)+亮像素 19534(聚光灯)。
  ASCII 确认玩家(青)/敌人(红)居中对峙、聚光灯池照亮舞台、菜单在干净背景、CTA 黄字突出。
- 官方 CI 5/5 绿（desktop×3 + 移动横/竖）；标题相关 dev 套件 14/14 绿
  （difficulty/music×4/retention×5/onboard/meta×2/volume），选择器上移未破坏任何命中/交互。
- 新增 `tests/art-review.spec.js`（全场景截图巡检）+ `tests/art.config.js`（art project），
  采集 11 个发布关键帧存 `tests/shots/art/` 供视觉复审。

**感知评估**：标题从"空洞+失衡+拥挤的 tech-demo 橱窗"变成"聚光灯下双人格斗的对决海报"，
视线流 标题→菜单→CTA→决斗 清晰。仍是 ASCII/指标代理（无真人观感）；未来可加：标题字符的
微动效、皮肤预览实时映射到 demo 玩家、或赛季/活动横幅位。

## Round 9 — 美术总监发布审查（第二轮）：Game Over「战败者海报」

以美术总监视角做第二次发布前全场景审查。本轮相比 Round 8 的关键差异：**首次能用图像分析
工具直接"看"截图**（之前 8 轮只有 ASCII/imgstat），故逐场景做了一次真实的视觉复核。

**排查结论（排除伪阳性）：**
- 标题屏（Round 8 已重塑）——良好，无需再动。
- 战斗/Boss/Second Wind——复核确认无回归：Second Wind「断臂」签名视觉**确实生效**（早期在
  Oracle 同屏的截图里分析误判为"双臂完好"，清场后单独抓帧确认右臂缺失、红晕去饱和正常）；
  Boss 1.6× 缩放正常、顶部血条在。
- **最伤玩家感知的是 Game Over 屏。** 量化证据：画面非空率仅 **9.0%**——与 Round 8 修复前
  的标题（9.7%）同病：稀疏、空洞。它是每一局的**最后一帧**、是"再来一局 vs 退出"的留存枢纽，
  却从未被美术指导过，且把 D1 留存钩子（"明日 daily"、解锁进度）做成 13px 灰字几乎不可见。
  问题清单：①中段死区大；②顶重底轻；③留存钩子隐形（业务价值浪费）；④零能量（静态文字，
  brawler 的结算该有冲击）；⑤尸体与 CTA 在底部挤撞。

**修复（`GameOverScene.js`，纯视觉/布局 + 轻量动效，零机制/数据改动，遥测 shape 不变）：**
复用 Round 8 标题已验证的工具箱，语汇统一：
- **败北聚光灯**（`_buildMood`/`_drawSpot`，ADD 混合、低 alpha）：把标题的青色舞台灯调成
  ** mournful 红**，从 y408 张开到地面，照亮倒地火柴人 → 把中段死区变成有氛围的戏剧光，尸体
  从"杂物"升格为情绪焦点。`update()` 里做 1.7s 慢呼吸让静帧有生命。
- **分数英雄 + 计数动画**：分数独占一张描边卡片、54px 大字，`tweens.add` 0→终值（Cubic.out
  0.85s）逐帧滚动——结果"挣来的"而非"盖戳"。下方 WAVE/COMBO/KILLS 三列支撑行。
- **结果标语**：新纪录→"NEW PERSONAL BEST!"（金、大）；否则→"YOU REACHED WAVE N"（把失败
  重构为进度，利于再开）。
- **留存带（"REASON TO RETURN"）可见化**：定义列表式版面（暗标签 | 亮值），NEXT UNLOCK（青）
  与 TOMORROW（黄）各成一行，13px 灰→16px 亮，**彻底解决隐形钩子 + 两栏文本中线撞车**。
- **CTA 与尸体分离**：CTA 上移到 y560（脱离地面尸体区），28px 黄字描边+投影+呼吸；尸体放大
  1.15× 作为聚光灯下的战败主角；生涯行压到 y706 底边。
- 调色与字体与标题/UIScene 完全一致（Impact/Arial Black + #35e1ff/#ffd23f/#ff3b30 + 描边投影）。

**验证（本轮图像直读 + imgstat + 全测试）：**
- 画面非空率 **9.0% → 14.7%**（+63%，与 Round 8 标题的密度补救同量级）。
- 图像复核确认：聚光灯红锥成立、分数为视觉焦点、倒地火柴人为戏剧主角（不再与 CTA 撞）、
  NEXT UNLOCK/TOMORROW 两行全可见无截断、CTA 黄字清晰。
- 官方 CI **5/5 绿**（desktop×3 + 移动横/竖）。
- 触达 gameover 的 dev 套件 **20/20 绿**（retention 5 / laststand 4 / music 4 / qa 7）。
- 既有断言全部基于 `state==='gameover'` 遥测与截图，shape 未变，无回归。

**感知评估**：Game Over 从"稀疏、零能量、把留存钩子藏起来、尸体挤撞 CTA 的占位屏"变成
"聚光灯下战败者海报 + 滚动分数 + 可见的回归理由 + 清晰 CTA"——把每一局的**最后一帧**变成
驱动"再来一局"的杠杆。视线流 判决→(新纪录)→分数→留存理由→CTA→战败主角 清晰。仍是图像
代理指标（无真人观感）；未来可加：结算→直接重开（当前回标题可选肤/难度，是有意设计）、
新纪录的金色粒子爆发、或按成绩动态调聚光灯色（深进 vs 惜败）。





## Round 10 — 首席设计师审计（全新4-persona实测）

重跑原始审计找"今天仍伤害玩家的问题"。实测遥测(NORMAL)：

| Persona | 时长 | Wave | 分 | 最佳连击 | 终血 | 挨打 | 治疗 | 击杀 |
|---|---|---|---|---|---|---|---|---|
| 新手AFK | 30s | 1 | 0 | 0 | 55 | 5(45) | **0** | 0 |
| 休闲 | 60s | 4 | 2915 | 9 | 18 | 8(82) | **0** | 9 |
| 硬核 | 90s | 5boss | 6765 | 19 | 74 | 2(26) | **0** | 12 |
| 移动 | 45s | 2 | 860 | 4 | 53 | 5(47) | **0** | 4 |

**关键异常：所有 persona healed=0**——血包掉在尸体上、42px收集半径、无磁吸、
9s寿命，没人捡。休闲18血0回血=不公平的死；Second Wind重塑(需回血)实际不可达。

Top10与修复顺序详见 DESIGN.md Round 10。本轮先修 #1 资源循环（拾取磁吸）。

### Round 10 — Fix #1 资源循环（拾取磁吸）已上线
- 根因：血/狂怒拾取物掉在尸体上、42px收集半径、无磁吸、9s寿命，实测 healed=0
  全 persona。磁吸是根修复，并让 Second Wind 塑造可达。
- 改动：
  - `config.js`：PICKUP 加 MAGNET_RANGE(150)/MAGNET_SPEED(760)/MAGNET_STEER(22)。
  - `Pickup.js`：粘性磁吸——进入范围后转向追踪玩家（速度直接导向，瞬间抵消上弹），
    homing 标志粘性防抖；离地飞向玩家。
  - `GameScene.js _reform()`：补 `p.reformed=true`（潜在遥测 bug：曾被读从未写）。
- 验证：新增 `tests/magnet.spec.js` 3/3（范围内收集/范围外静止/破碎拾血重塑）；
  官方 CI 5/5、laststand 4/4 全绿。
- 真人对局证明（休闲 persona 同脚本）：终血 18→74、healed 0→25、分 2915→4135、
  最佳连击 9→13、击杀 9→12、还吸到狂怒(7.3s)。不再不公平地流血致死。

### Round 10 — Fix #2 新手引导（训练假人）已上线
- 根因：AFK新手30s仍卡wave1、0击杀0分、流血到55血。"PRESS J"文字救不回还没把J=拳
  联系起来的玩家——敌人先打到了他，他从未拿到教会循环的FIRST BLOOD首杀。
- 改动：
  - `config.js`：RETENTION 加 FIRST_ENEMY_PASSIVE_GRACE(5.0s)。
  - `Enemy.js`：构造加 passive/passiveT；takeHit 命中即解除被动；AI 在进入射程前无条件下
    tick passiveT（从生成起算的全局休战，非进入射程后），超 grace 或被命中则 passive=false；
    被动时只靠近不挥拳。
  - `GameScene.js spawnOne`：捕获 firstOfWave 标志（原 waveFirstSpawn 在创建前被清空），
    wave1 首敌设 e.passive=true。
- 验证：新增 `tests/onboarding-assist.spec.js` 4/4——wave1首敌被动且射程内0伤害；命中解除；
    grace到期解除（确定性，驱动passiveT到阈值）；**集成：发愣2.5s后乱按J的真实新手拿到首杀
    +FIRST BLOOD、0伤害**。官方CI 5/5、retention 5/5、onboard 1/1 全绿。
- 诚实局限：纯AFK(从不按键)无法被"奖励参与"的机制拯救，其数字不变；本引导针对"会试按J但
    需要点时间"的更大众人群。

### Round 10 — Fix #3 移动端按住连击已上线
- 根因：移动端860分 vs 键盘6765分。Round1加大了按钮但没解决吞吐——一次点=一挥，
  拇指的 点-抬-点 天生慢，跟不上键盘连按J。
- 改动（`UIScene.js`）：PUNCH/KICK 触屏按住自动连击。按住时每帧重新置 punchPressed/kickPressed
  边沿，攻击循环一结束立即接下一发（tryAttack 挥击中 no-op，自动同步攻击节奏，不会失控）。
  键盘保持边沿触发；JUMP 不变（已有变高跳语义）。
- 验证：新增 `tests/mobile-autofire.spec.js` 2/2（按住≥3挥 / 单次点=1挥不失控）；官方CI 5/5
  含移动横屏。
- 真人对局证明（30s 慢拇指）：离散点击(400ms) 380分/2杀/3连 vs 按住 1440分(3.8x)/4杀(2x)/
  9连(3x)。移动端现在能像键盘连按一样流畅连击。

### Round 10 — Backlog #5 死时间（敌人冲刺入场）已上线
- 根因：wave4+ 敌人从墙边(x≈74/1206)走到中场(~640)约560px，~3.8s 无事可做的空窗。
- 改动：墙边出生的敌人(wave4+)获得 0.6s 入场冲刺(2x 接近速度)，只作用于接近阶段
  (commitRange 外)，进入战斗即恢复常速。内移带出生(wave1-3)不开冲刺(已够近)。
  - `config.js`：RETENTION.SPRINT_IN {TIME:0.6, BOOST:2.0}。
  - `Enemy.js`：构造 sprintT；update 无条件衰减；接近移动行乘 sprint 倍率(仅 sprintT>0)。
  - `GameScene.js spawnOne`：`!early`(墙边)时 `e.sprintT = SPRINT_IN.TIME`。
- 验证：新增 `tests/sprint-in.spec.js` 3/3（wave4墙边出生设sprintT/early内移带不设/冲刺期速度>基础1.4倍）；
  官方CI 5/5。

### Round 10 — Backlog #6 休闲连击（击杀桥接）已上线
- 根因：休闲最佳连击卡在 9（够不到 x10 里程碑），因 2.2s 窗口无法跨过"敌人死亡→下一个走上来"的空档。
- 改动：击杀桥接——每次击杀把连击窗口延长到 COMBO_WINDOW+COMBO_KILL_BRIDGE(2.2+0.9=3.1s)，
  让"击杀→下一个敌人"的核心爽快循环不断链。非致命命中仍用基础 2.2s 窗口。
  - `config.js`：COMBO_KILL_BRIDGE = 0.9。
  - `GameScene.js _onPlayerHit`：killed 分支 `comboTimer = max(comboTimer, COMBO_WINDOW + COMBO_KILL_BRIDGE)`。
- 验证：新增 `tests/combo-bridge.spec.js` 2/2（非致命=基础窗口/击杀=含桥接）；combo 回归通过。

### Round 10 — Backlog #4 硬核威胁（群体压迫）已上线
- 根因：硬核 90s 仅挨 2 打——能 stunlock 单列敌人、轮流应付单次挥击，普通波零威胁。
- 改动：pack pressure——同场活敌 > SWARM_THRESHOLD(3) 且 wave >= MIN_WAVE(3) 时，每多一个敌人
  加攻击激进度(AGGR_PER 0.10) + 移速(SPEED_PER 0.07)，上限 MAX_BONUS 0.35。奖励"快速清场防成群"，
  威胁被动玩法；1-2 敌的小战斗(休闲前期)不受影响。
  - `config.js`：ENEMY.SWARM {THRESHOLD:3, MIN_WAVE:3, AGGR_PER:0.10, SPEED_PER:0.07, MAX_BONUS:0.35}。
  - `Enemy.js`：构造 swarmMul/swarmSpeedMul；_startAttack `aggr = aggrMul * swarmMul`；接近移动 `* swarmSpeedMul`。
  - `GameScene.js update`：每帧按活敌数算 swarmAggr/swarmSpeed 写入各敌人。
- 验证：新增 `tests/pack-pressure.spec.js` 3/3（小战斗无加成/群体加成且aggr>speed/wave<3豁免）；
  官方CI 5/5、variety 14/14 全绿。（中途一次 CI 失败为我强杀超时命令留下的孤儿进程争用8080，清掉后全过，非回归。）

### Round 10 — Backlog #9/#10 评估（不改）
- #9 Boss卡wave5：累积修复后休闲满血到wave4(连击10)，差一波到Boss；Second Wind任何波触发；
  vanguard(wave2)+事件(wave3+)给中段高潮。wave-5是刻意留存钩子，降低反削吸引力且破坏every-5节奏+测试。不改。
- #10 局内元进度：Round 4 已实现 HUD "NEXT→目标·皮肤" 目标条(按波刷新 Meta.nextUnlock)。已验证存在。不改。

### Round 10 backlog 总结
全 8 项处理：#1磁吸/#2假人/#3按住连击(已上线) + #4群体压迫/#5冲刺入场/#6击杀桥接(本轮上线) +
#7/#8随#1/#2解决 + #9/#10评估不改(已由既有实现或累积修复缓解)。
新增测试：magnet3/assist4/autofire2/sprint3/bridge2/swarm3 共17项，全绿。
最终persona：休闲 18血0治连击9 → 满血50治连击10；硬核分6765→11660、连击19→30。

## Round 11 — 趣味导向：OVERDRIVE 主动大招（玩家自造高潮）

以独立游戏设计师视角，游戏已稳定且内容丰富（10轮迭代）。做了一次纯趣味审计：

- **兴奋时刻**：Boss击杀、Second Wind重塑、连击里程碑、FIRST BLOOD、炸弹/陨石混乱。
- **无聊时刻**：反应性高潮（Boss/Second Wind）之间的"自动朝向 + J/K"循环——全程没有任何玩家**主动发起**的高潮。
- **流失点**：见过两个Boss（~wave10）后；高潮之间的平坦段没有拉力。
- **故事性**：Second Wind是旗舰（"差点死然后反杀"），但玩家从未能**选择**一个"我现在就是危险本身"的瞬间。

**结构性缺口**：每个伟大格斗游戏都给玩家一个自造、自选的能量爆发（SoR星技 / 无双乱舞 / 魔人化 / Hades召唤）。Stickman Arena 没有。Rage 拾取是被动 RNG 增伤，不是主动按钮——这是最大的趣味杠杆。

**三个候选**：① OVERDRIVE 大招槽（玩家自造的主动超必杀）② 临时武器拾取 ③ 空中连段系统。选 ① ——填补结构性缺口，玩家**选择**高潮，最高杠杆、最低风险，复用全部既有 juice 原语。

### 改动
- `config.js`：新增 `BURST` 调参块（满值100 / 命中+5 / 击杀+12 / 挨打+9 / 蓄力0.22s / 释放0.30s / 半径520 / 普敌45伤 / Boss固定50 / 击退760 / 无敌0.75s / 每击杀加分60 / 键位 L）。
- `Player.js`：`burst` / `burstMax` 状态。
- `GameScene.js`：
  - `_tryBurst()` —— 满槽才放；**可在 hurt 状态下释放**（panic-button / 连段破局——被锁挨打正是想放大招的时候，更爽）；消耗整槽；蓄力起即无敌。
  - `_releaseBurst()` —— 径向波：范围内肉搏敌 45伤+大击退（小怪直接死）、Boss 固定 50（切一块，绝不一击必杀）、**蒸发范围内敌方投掷物**、**吹灭范围内地面火**；反馈峰值仅次于 Boss 击杀（BOSS_KILL级缩放+环+双色粒子+0.4s慢镜+重屏震+"OVERDRIVE!"横幅+每击杀浮字）。
  - `_updateBurst(dt)` —— windup→release 状态机 + 扩展波绘制（独立 `burstLayer` depth22，不与冲击波层冲突）。
  - 槽位积累：`_onPlayerHit` 命中+5/击杀+12、`_onPlayerHurt` 挨打+9；**蓄力期 `_addBurst` no-op**（大招不给自己刷槽）。
  - 键盘 L + 控制 `c.burstPressed`；遥测/HUD 加 burst/burstMax/burstReady/bursting/bursts；`__test` 钩子 fillBurst/setBurst/burst/playerX。
- `UIScene.js`：HP 下方金色 OVERDRIVE 槽条（满时脉冲发光 + "PRESS L"/"TAP" 提示）+ 触屏专属 BURST 按钮（右上，仅满时发光放大可点）。

### 验证
- 新增 `tests/burst.spec.js` **7/7**：命中+5 / 击杀+17(命中+击杀) / 挨打+9 / 未满不放 / 清场三人 / Boss固定50(±2) / 清投掷物+灭火。注册 `burst` project。
- 官方 CI **5/5**（桌面×3 + 移动横/竖）；boss3/depth3/laststand4（10/10）；**variety14/14**（投掷物/火区/事件/盾/爆/射全过——验证 `_releaseBurst` 不破坏既有层）；retention5/bossvariety4 全绿。共 60+ 项零失败。
- 新增 `tests/eval-burst.spec.js`（`evalburst` project）：75s 真人对局，激进 persona 槽满即放大招。结果：**3 次 OVERDRIVE**、到 **wave 5 Boss**（DESIGN Round10 硬核 90s 仅到 wave4）、14杀/连击23/终血79/治疗25/3次挨打、**零报错**。证明大招在对局里自然触发、制造玩家自选的高潮。

### 趣味评估（结构/机制代理指标 + 真人对局遥测）
| 维度 | 改前 | 改后 |
|---|---|---|
| 玩家自选高潮 | 零（全是反应性） | ~每25s一个（75s放3次） |
| 旗舰内容可达 | 硬核90s到wave4 | 75s到wave5 Boss |
| 决策 | 无（踢spam最优） | "何时放大招"=每局多次决策 |
| 故事性 | "打到wave N" | "6个围上来，我引爆清场" |
| 反击/逃生 | 仅Second Wind(0血) | Overdrive panic-button（满槽即可） |
诚实保留：仍是代理指标+遥测，非真人手感；Boss固定50确保大招跳不过Boss战（设计意图）。下轮候选：把 Overdrive 触发数/最大连击引爆数接入 Meta 解锁（"曾一次引爆N敌"徽章），或给放大招加一段专属处决动画。

## Round 12 — 首分钟留存：新手引导 / 奖励节奏 / 进度（专注留存）

任务前提：**假设玩家只玩 60 秒**。分析首分钟体验、找出留/走原因、改进 onboarding / reward pacing / progression，**只做留存**。

### 首分钟分析（DESIGN Round10/11 遥测 + 源码通读）
**留下来的原因**：FIRST BLOOD(~3-5s第一个多巴胺峰值) / 连击层级+juice / 分数可见爬升 / OVERDRIVE槽期待感 / 目标chip("NEXT → wave5 · EMBER皮肤") / wave5 Boss承诺。
**60秒内离开的原因**：
1. **CRITICAL — 新手在 wave1 流血至死（D1 流失）**：AFK = 0杀0分，wave1 被打死。训练假人只对**第一个**敌人有效；第2/3个 wave1 敌人正常攻击，冻结的玩家被围殴。Round10 AFK persona 30s只剩55血。
2. **OVERDRIVE 60秒内对休闲/移动端不可达**：蓄满需 ~25-35s 稳定战斗；休闲/移动端打不到那个量。旗舰主动高潮对最危险人群隐形。
3. **开局3-5秒分数为0**：要等敌人进入射程并命中才得分。最易流失的时刻屏幕显示"0"。
4. **移动端治疗环断裂**：0治疗（磁铁需要击杀，移动端杀不动）。
5. **Game Over 羞辱 wave1 死亡**："YOU REACHED WAVE 1"，无前瞻指引。

### 三支柱改动（仅留存）

**A. 新手引导（修前30秒）**
- **A1 wave1 全场休战**：把训练假人标记从"仅第一个 wave1 敌人"升级为**场景级 gate**——休战期内**每个** wave1 敌人都 passive。冻结玩家不可能在 wave1 被围殴。玩家首次命中即结束休战；或 12s 全局计时器到期结束。新增 `WAVE1_TRUCE_TIME: 12.0`；每敌人5s自过期改为仅在休战结束后才触发的兜底。
- **A2 标题 J 标签**：标题界面对打的演示小人出拳时，旁边浮一个发光的"J"。底部控制行在 400px 外易忽略；把键位绑订直接钉在动作上，开局前就用视觉教会 J=出拳。

**B. 奖励节奏（修多巴胺曲线）**
- **B1 OVERDRIVE 蓄力种子**：开局给 35（满 100）+ FIRST BLOOD 再 +15。旗舰玩家自选高潮从 ~30s 缩到 ~15-20s 可达——休闲/移动端也能在 60s 内放出。
- **B2 首动作分数**：首次移动 +5、首次跳跃 +5、首次命中 +10（叠加在命中本身得分上）。分数从第1秒就爬升，不再"0"3-5秒。每局一次性、仅 wave1。
- **B3 保底早期治疗**：wave1 第3次击杀若 HP<满，**必掉**治疗。磁铁（Round10）负责送达。30s 内让治疗环对所有人都转起来，即便 RNG 冷整局。

**C. 进度（修"为何回来"）**
- **C1 ROOKIE 皮肤（首关通关解锁）**：新皮肤"ROOKIE"，clear wave1 即解锁（bestWave>=2，派生自既有 stat 不新增）。在 `nextUnlock` 排序首位——新账号看到的是"clear wave 1 · 0/1"而非"reach wave 5"。任何活过开局的人都能在 <60s 内拿到第一个化妆品，单局内启动 meta 循环。新增 `waveclear` 解锁类型。
- **C2 早期死亡的 Game Over 提示**：wave1/2 死亡且非新纪录时，CTA 上方加一行语境提示：wave1→"TIP: hold J to chain punches — the first hit is free"；wave2→"TIP: press K to kick enemies back when surrounded"。最易流失永不再来的人群给一条具体可执行的前瞻动作，让第2局比第1局好。

### 改动文件
- `config.js`：`RETENTION.WAVE1_TRUCE_TIME`、`FIRST_MOVE_SCORE`/`FIRST_JUMP_SCORE`/`FIRST_HIT_SCORE`、`EARLY_HEAL_KILL`；`BURST.START_METER`、`BURST.FIRST_BLOOD_BONUS`。
- `GameScene.js`：`wave1Truce`/`wave1TruceT` 状态 + `_endWave1Truce()`；spawn 标记改为 `n===1 && this.wave1Truce`；首次命中结束休战；wave1 计时器到期结束休战；首命中+15大招、+10分；首动作分数（move/jump）；wave1 第3杀保底治疗。
- `Enemy.js`：每敌人 passive 自过期 gate 在 `!scene.wave1Truce`（休战期不提前结束）。
- `Player.js`：`burst` 初始化为 `START_METER`（35）。
- `TitleScene.js`：`demoKey`（出拳时发光的 J 标签）。
- `GameOverScene.js`：wave<=2 死亡的语境提示行。
- `Meta.js`：`rookie` 皮肤（waveclear 类型）+ 排序首位；`waveclear` 解锁逻辑（bestWave>=value+1）。

### 验证
- 官方 CI **5/5**（桌面×3 + 移动横/竖）。
- 新增 `tests/firstminute.spec.js` **11/11**（A1 三项: 全体passive/首命中结束休战/AFK12s零伤；A2 标题J标签；B1 槽初始35+首杀加成；B2 首移动/首跳分数；B3 第3杀保底治疗；C1 ROOKIE解锁；C2 wave1死亡提示）。注册 `firstminute` project。
- 调整：`onboarding-assist` test3（grace→scene truce gate）；`retention` Meta test（ember→rookie 首位）；`burst` test1/2/3（隔离 v2 seed + first-blood 加成，专注 +5/+12/+9 delta）。
- 4-persona 真人对局（`playthrough`）首分钟实测：

| Persona | 指标 | Round10 | 本轮 | Δ |
|---|---|---|---|---|
| AFK 30s | 终血 | 55 | **91** | +36（D1 流失修复） |
| AFK 30s | 挨打次数 | 5 | **1** | -4 |
| 休闲 60s | 分数 | 4190 | **7870** | +88% |
| 休闲 60s | 最高连击 | 10 | **35** | +25 |
| 休闲 60s | 大招蓄满 | 否 | **是** | 旗舰可达 |
| 硬核 90s | 波数 | 4 | **5(Boss)** | +1 |
| 硬核 90s | 最高连击 | 30 | **47** | +17 |
| 移动 45s | 终血 | 53 | **73** | +20 |
| 移动 45s | 大招蓄满 | 否 | **是** | 旗舰可达 |

- 全部 dev 套件零回归：assist4/retention5/meta2/burst8(含75s真人)/onboard/combo/bridge/magnet/swarm/depth3/laststand4/qa7/variety14(含bossvariety4)/playthrough4/difficulty/sprint3/autofire2/music4/volume/eval/boss3(含75s真人)/evalburst —— **109/109 通过**。

### 诚实保留
- AFK persona（永不按 J）只能被"延迟死亡"救——休战给 12s 安全窗，过了仍会流血。但 12s 足以读完屏幕、看到"PRESS J"救生圈、试着按一下。目标人群是"会试 J 但需要一点时间"的远更大群体。
- B3 保底治疗在 casual/mobile 本轮未触发（wave1 击杀不到3即进入 wave2）——它是安全网，主治疗环（磁铁+掉率）仍工作；casual 本轮终血82（健康）。
- 留存是结构/机制代理指标 + Playwright 遥测，非真人手感。

## Round 13 — 内容多样性扩展（敌人 / 遭遇 / 稀有事件 / 环境交互）

任务前提：**攻"游戏重复感"，只加内容、不改系统架构**。所有新机制复用既有模式
（VARIANTS 字典、slam/cast 状态机、throw windup、hazard 数组、shockwave 数组、
事件 flags 总线、banner/slowmo 反馈原语）。本环境 Chromium 库已就位，全部测试实跑。

### 新增 4 类内容

**1. 敌人多样性**（`Enemy.js` VARIANTS + 专属 AI 分支 + 装备叠层）
- **charger**（暗红、44hp）：中距触发**预警冲锋**（0.55s 蓄力→620px/s 锁定直线冲刺
  0.5s→0.6s 硬直），冲刺期**超甲**（轻击无效、重踢可断，镜像 boss-slam 模型），
  冲刺期高 hitbox。填补"地面逼走位/跳跃"niche（区别于 leaper 防空）。counter=跳/侧移。
- **medic**（白青、30hp）：kite 保持距离，对范围内**最低血友军**引导治疗脉冲（0.7s 蓄力
  →+18hp+绿光束，复用 throw windup+`_healBeam`）。弱近战自卫。逼**目标优先级**决策。
- **splitter**（棕岩、40hp）：标准近战，**死亡分裂**为 2 个 spawnling（`_onSplitterDeath`
  场景钩子，继承波次缩放）。奖励过杀（免增员）、制造涌现式群体压力。裂纹辉光随血量降低变亮。
- **spawnling**（小棕、12hp、scale 0.7、速 210）：仅由 splitter 死亡产生，小而脆且凶。

**2. 环境交互**（复用 hazard 数组，新增 `kind` 字段，三种区域共用 update+draw 循环）
- **ice patch**（打滑区）：无伤害，玩家站入设 `player.slipT`，Player 物理读它把
  摩擦×0.06、转向×0.35——**动感变化**（滑行），非新系统。青色冰板+霜裂纹+漂移冰晶。
- **heal shrine**（治疗神龛）：火区逆极性——站入按 tick 回血（每 tick 6，每龛上限 70），
  有**争夺点**意味。金色符文环+绿核心+上升光点；敌人不受其治疗。
- 火（原有）逻辑零改动，仅分支化。

**3. 遭遇/稀有事件**（`js/systems/Events.js` + GameScene flags，事件 8→12）
- **FRENZY**（玻璃大炮波，wave≥4）：`eventFrenzy` → `_applyScaling` 速×1.35、激进度×1.3、
  血×0.45。纯粹数值翻转，整波"快而脆"，体验完全不同。
- **AMBUSH**（镜像夹击，wave≥4）：`eventAmbush`+extraSpawns+1 → 每次 spawn 镜像出双侧
  （`_spawnEnemyAt` 抽取，MAX_ALIVE 守卫）。开局即被两侧夹击的"包围"形状。
- **PLAGUE**（医疗兵+炸弹波，wave≥5）：`eventVariantPool=['medic','bomber','medic','charger']`。
  支援+混乱组合，"先杀医疗兵"的目标优先级练习。
- **BLESSED GROUND**（神龛波，wave≥3）：`eventShrines`→`_dropShrines` 在两侧各投一个治疗神龛。
  正向"喘息+争夺"波，仍带正常敌人。

**4. 接入**（零系统改动）
- spawn 加权表加 charger(wave≥5)/medic(wave≥5)/splitter(wave≥4)，wave1 仍纯 grunt、
  wave2 仍 vanguard 首刷（retention 约定不变）。
- `_applyScaling` 加 frenzy 分支（flag off 时 no-op）。
- `_updateHazards` 重写为 kind 分发（fire/ice/shrine），火区行为字面保留。
- `spawned`/`counts`/遥测加 charger/medic/splitter/spawnling；`__test` 加 spawnIce/spawnShrine/
  killSplitter/setFrenzy 钩子；`_spawnEnemyAt` 抽取自 spawnOne 供 ambush 复用。

### 验证（实跑，零回归）
- 新增 `tests/variety2.spec.js` **10/10**：charger 冲锋+超甲+hitbox、medic 治疗最低血友军、
  splitter 死亡分裂≥2 spawnling、ice 设 slipT+滑行实测、shrine 回血、frenzy 数值翻转、
  ambush 每次出 2、plague 池、blessed 投 2 龛、事件总数≥12。
- 原有 `variety` **10/10** 全绿（事件总数从 8 涨到 12，断言 `>=8` 不破坏）。
- 官方 CI **5/5**（桌面×3 + 移动横/竖）。
- dev 关键套件 **33/33**：depth3、swarm3、qa7（含 1min 尸体动画+30s 无完美重叠）、
  boss3、burst8（含 75s 真人 wave5 Boss+4 大招）、laststand4、retention5。
- ASCII+imgstat 抓帧确认：charger(R)/medic/splitter 火柴人 + 右侧冰板/神龛青色光区均可见，
  全程零 pageerror。

### 趣味评估
这轮杠杆是让**每一波都可能不一样**且**每种敌人逼不同应对**：冲锋要跳/侧移、医疗兵要
优先击杀、分裂要过杀、冰面要控速、神龛要争夺；加 4 个事件让波次形状不再单调（玻璃/夹击/
瘟疫/祝福）。重复感显著下降。仍是代理指标+遥测，非真人手感。

## Round 14 — 游戏手感 Pass 2（纯反馈增强，零新机制）

用户明确要求：**只增强打击满意度，不加新机制**。聚焦 7 维：命中效果/屏震/冲击反馈/
粒子/预备动作/攻击时机/相机运动。约束：depth 套件锁定的攻击时序（punch 0.31s /
kick 0.46s 连接、0.62s 空挥）与伤害（11/16）一字未改，boss 大招固定 50 不动。

### 改动（5 文件）
- `config.js`：`FEEL` 块大扩展。
  - **SHAKE**（新）：8 事件档（HIT/HEAVY/HURT/KILL/BOSS_KILL/SLAM/BLAST/BOSS_ENTRY/EVENT），
    每档 amp/life/freq + 共享 NOISE_MIX=0.35 + CUTOFF=0.25。低频正弦=重量感，非 Phaser 噪声 buzz。
  - **STRETCH**（新）：HIT/HEAVY/KILL/WINDUP/ACTIVE/LAND 五种挤压规格 + TAU=0.07 反弹。
  - **TRAIL**（新）：拳头/脚 active 帧的运动残影（LIFE=0.16s, WIDTH=6, MAX=14 采样）。
  - **DEBRIS**（新）：K.O. 暗色身体碎片（重力下落）+ 向上爆发火花（负 gravityY=发射感）。
  - **CAM_BASE_ZOOM=1.0**（最终值）+ **CAM_LOOKAHEAD=18**：相机只在冲击期 zoom-in 时获得 pan
    headroom，看向玩家朝向（"撞向打击方向"）。基础保持 1.0 不露世界边缘。
  - **ZOOM.COMBO_STEP/MAX/TAU**（新）：每次连命中 +0.006 zoom，慢衰减（0.45s tau），上限 0.045——
    连段时画面"知道你在打连招"。
  - **ZOOM/SHOVE/RING/PAUSE 全部上调**（如 HIT 0.018→0.024、KILL 0.050→0.066、BOSS_KILL
    0.095→0.115），冲击峰值更强但 MAX 从 0.12→0.135 防眩晕。
- `Stickman.js`：新 `squashX/Y`（默认 1）+ `_baseScaleX/Y`（默认 1，boss=1.6）。`pushStretch(sx,sy)`
  推入形变（同向取更大者），`tickStretch(dt)` 指数衰减回 1。重写 `setScale` 同步 base。`render()`
  应用 `scaleX = base*squash`。
- `Player.js`：`tryAttack` 触发 windup 形变（1.10/0.90 蹲伏蓄力）+ 地面 dustBurst（5 粒）；active
  峰值推 ACTIVE 形变（1.08/0.94 拉伸）。硬落地（vy>720）触发 LAND 形变（1.18/0.82 拍扁）+ _shake。
  `_render` 在 active 帧采样拳头/脚世界坐标推到 `scene._pushTrail`。所有 update 分支调 tickStretch。
- `Enemy.js`：`takeHit` 按 hit 重量推形变（HIT/HEAVY/KILL 三档）。hit flash 重做为分层（外青光晕
  + 白热核心 + 品红打击点 + 白描边）— 比 1 层白盘冲击感强 4 倍。bodyBox/getHitbox 改读
  `_baseScaleX` 而非 live scaleX（避免挤压帧命中盒漂移，保战斗稳定）。`update` 顶部统一 tickStretch。
- `GameScene.js`：
  - 新增 `_shake(amp,life,freq,dirX,dirY)` —— **替换全部 cameras.main.shake 调用**（19 处）。
    衰减正弦 + 噪声混合，方向偏置（横向打击→横向震）。相位连续不重置，cutoff 杀尾抖。
  - 新增 `_comboZoomStep()` —— 连击 zoom 升级入口。
  - 新增 `_pushTrail(x,y,color,key)` + `_updateTrails(dt)` —— 按 key 分组的运动残影绘制
    （tail→head alpha 与宽度递增）。
  - 新增 `debrisEmitter` + `launchEmitter` —— K.O. 双层粒子（暗碎片+上向火花）。
  - 重写 `_updateCamera` —— 精确 headroom 公式 `(1-1/zoom)/2*0.85`，look-ahead 仅在 zoom-in 时生效，
    shake+shove+look 组合钳制在 headroom 内（永不露边）。
  - 命中/受伤/击杀/Boss 击杀/大招收尾/破碎/重塑分支全部接入新 shake + 形变 + 分层粒子。
  - hitpause 分支也调 `_updateTrails`（冻结帧残影继续划过=经典 impact tell）。

### 7 维改进映射
| 维度 | 改动 |
|---|---|
| 命中效果 | 分层 chromatic hit flash（青/白/品红/描边）+ 方向火花保留 |
| 屏震 | 自定义衰减正弦 impulse shake 替换 Phaser 噪声（重量级而非 buzz） |
| 冲击反馈 | squash-&-stretch（敌人被命中形变，玩家挥击形变）+ hitpause 微增 |
| 粒子 | K.O. 双层（暗碎片+上向火花）+ 残影 trail + windup dust |
| 预备动作 | 玩家挥击 windup 蹲伏（1.10/0.90）+ active 拉伸（1.08/0.94）+ windup dust puff |
| 攻击时机 | 时序一字未改（depth 套件锁定）；改的是体感——蹲伏+拉伸让挥击弧可读 |
| 相机运动 | impulse shake + combo-escalation zoom + impact-moment look-ahead |

### 验证
- 官方 CI **5/5 绿**（desktop×3 + 移动横/竖）。
- dev 套件 **17/17 绿**（depth3/laststand4/magnet3/qa7）—— 摄像头修正后无回归。
- 早前 dev 跑（修摄像头前）**48/48 + 43/44**（magnet 一过性 flaky，单独重跑 3/3 稳过）。
- 新增 `tests/feel14-visual.spec.js`（注册 `feel14` project）：6 场景截图 + ASCII/imgstat
  抓帧。确认：idle 角像素=(9,11,18)（=背景渐变，无 #0b0e16 露边）；K.O. 帧 cyan=14767
  + bright=4114（碎片+环+launch 三层粒子可读）；overdrive 帧 cyan=17979 + yellow=2203
  （金/青粒子风暴可读）；boss-slam 帧 red=14725（Boss+slam 环）；全程零 pageerror。
- 摄像头探针确认 idle 时 zoom=1.0/scrollX=0（世界矩形精准填充，无边缘伪影）。

### 设计决策（多解取最爽的）
- **base zoom 取舍**：最初用 0.965 微 zoom-out 买 pan 余量做 idle look-ahead，实测角像素
  =（11,14,22）= Phaser `backgroundColor: '#0b0e16'` 露边。改回 1.0，look-ahead 仅在冲击期生效
  ——这恰好是相机该"撞向打击"的时刻，idle 不漂移反而更稳。
- **headroom 公式精确化**：旧 `(cam.width * camBoost) * 0.5 * 0.8` 是近似；新 `(1-1/zoom)/2*0.85`
  是精确值+安全系数。两者在 boost 小时几乎一致，但新版支持 base≠1 的组合（即便最终 base=1）。
- **enemy bodyBox 用 base scale**：boss 缩放 1.6 + 挤压时 live scaleX 会瞬变（1.6*0.86=1.376），
  命中盒会跟着缩——快连击可能 miss。改读 `_baseScaleX` 把命中盒和形变解耦，战斗稳定。
- **shake 不叠**：新 impulse 比残差弱则跳过（machine-gun punch 不累积致眩）；更强则覆盖。
  招式间隔自然，每发都脆。

### 诚实保留
- 趣味是结构性/机制性代理指标 + 真机遥测 + ASCII 抓帧，**非真人手感**。
- 真人手感需 A/B 盲测（无法在本环境做）；改动都基于公开 game-feel 原理（Disney 12 原则的
  squash/anticipation/follow-through + Vlambeer 的 impulse shake + Jan Willem Nijman 的 hit-stop）。
- look-ahead 比理想弱（仅在 zoom-in 时生效）——若未来愿意重做背景边界扩展，可恢复 idle 漂移。

## Round 15 — 趣味导向：MERCY「The Coward's End」（唯一的"意外"机制）

以创意总监视角：游戏已稳、已 juice、已有 Second Wind 旗舰。缺的是**玩家会主动讲给别人听**的
意外瞬间，且不能是通用功能。审计现有签名时刻：Second Wind（反应性 0 血高潮）、OVERDRIVE
（玩家自造爆发）、Boss 决斗（脚本化峰值）。缺的轴是**颠覆类型核心动词**——格斗游戏的动词是
"杀光一切"，而游戏从不打破它。这是杠杆。

### 三个候选（择优）
1. **MERCY 投降**（颠覆动词）✓ 选——几乎无 brawler 允许留活口；首次触发会有 2 秒"等等我该
   怎么办"的真暂停；火柴人骨架可读跪/鞠躬；每波结尾各异。
2. 尸体当武器（ragdoll golf）——好笑可分享但 bit 已知（Goat Simulator 等），不够 unusual。
3. 持久宿敌 Nemesis（跨局仇敌）——很可讲但需跨局持久化+命名+HUD，单轮范围过大。

### 机制：MERCY「The Coward's End」
- **触发**：非 Boss 波、wave≥2、玩家非 broken、场上仅剩 1 名活敌、该敌 HP≤30% max、且本波
  未触发过（`mercyDone` 每波 gate）→ 45% 概率（一次性 roll）该敌**投降**。
- **投降表现**：丢武器、跪地（新 `surrenderPose`：臀落近地、双手举过头、颤抖正弦、白旗在杆
  上波动）、脚下白色聚光灯池、战斗音乐 duck 到 menu 强度、横幅 **"MERCY?"**、0.25s 慢镜。
- **三选一（~2.8s 窗口）**：
  - **SPARE**（H 键 / 左上 SPARE 触屏钮）：敌起立鞠躬 → 步行离场（`depart` 阶段，460px/s）。
    奖励 = `150×wave×scoreMul`（严格 > WAVE CLEAR 的 100×wave）+ **必掉拾取物**（50% 治疗/
    25% 狂怒/25% 分数宝石，磁铁送达）。反馈：慢镜 0.35s + 白环 + 金/白双色粒子 +
    "MERCY +N" 横幅。`departed` 保持 false → 波在敌真正走出场时才 clear（让 MERCY 横幅先呼吸，
    再接 WAVE CLEAR）。
  - **KILL**（照常出拳/踢/大招）：正常死亡 + 正常奖励，**无惩罚**；叠加一层短暂灰色去饱和脉动
    （复用 veilLayer，灰色边框非红）+ "…" 浮字。`mercyKills` 计数。
  - **IGNORE**（窗口超时）：敌"失去希望"→ 全速冲刺离场（`flee` 520px/s），`departed=true` 立即
    放行波 clear；"…coward" 小喜剧浮字。`mercyFlees` 计数。

### 为何"意外/可记忆"而非通用
1. **颠覆类型核心动词**（杀光一切）——brawler 几乎不留活口，首次触发你真不知道该怎么办。
2. **火柴人专属**：跪+鞠躬+双手举起在骨架上完全可读，是这种美术风格能承载的情绪。
3. **每波结尾各异**：残暴清场 / 安静仁慈 / 黑暗击杀 / 喜剧逃跑——无新内容却有复玩差异。
4. **造故事**："我在第 7 波放了所有人" / "我杀了投降的家伙，不太好受" / "最后一个被我吓跑了"。
5. **稀缺性**：每波 1 次 + 45% + 低血量 + 非 Boss 门控 → 永远是故事，不是套路。

### 改动（5 文件，复用现有系统，新增面小）
- `config.js`：新增 `MERCY` 调参块（HP_FRAC/CHANCE/MIN_WAVE/WAIT_TIME/KNEEL_TIME/BOW_TIME/
  BONUS_PER_WAVE/SPARE_SLOWMO/FLEE_SPEED/EXCLUDED/PICKUP_WEIGHTS）。
- `Stickman.js`：新增 `surrenderPose(t,p)`（跪→鞠躬插值，tremble 正弦）+ `computePose` 加
  `'surrender'` case。
- `Enemy.js`：
  - `surrender`/`departed` 状态字段；`_startSurrender`（场景触发）→ `_progressSurrender`
    （kneel→wait→bow→depart / flee 状态机 + 物理 + 离场 destroy）；`_bow()`/`_flee()` 场景钩子。
  - `update()`：投降优先于所有动作状态（dead 之后第一分支）；`getHitbox()` 投降时返回 null
    （永不伤害玩家）；`_render()` 投降分支 + 旗帜/聚光灯 overlay（白旗杆+波动布+地面光池）。
  - `takeHit()`：bow/depart/flee 阶段返回 false（放过后无敌）；kneel/wait 仍可被击杀（KILL 路径）。
  - `isHittable()`：集中谓词（dead 或 post-choice 投降 → false），供 combat + Overdrive AoE 共用。
- `GameScene.js`：
  - 状态：`mercyActive`/`mercyDone`/`mercySpares`/`mercyKills`/`mercyFlees`/`_mercyKillVeil`。
  - `_maybeStartMercy()`：每帧触发检查；`_startMercyOn(e)`；`_onSurrenderStart(e)`（敌回调：
    设 mercyActive + "MERCY?"横幅 + 音乐 duck + 0.25s 慢镜）；`_spareEnemy()`（H/触屏入口）；
  `_expireMercy()`（窗口超时→flee）；`_tickMercy(dt)`；`_registerMercyKill(e)`（黑暗 "…" 节拍 +
  灰色 veil 脉动）；`_drawMercyKillVeil()`（复用 veilLayer 灰色边框）；`_restoreMusicAfterMercy()`。
  - `_onPlayerHit` 顶部：击杀投降中（kneel/wait）的敌 → 调 `_registerMercyKill`。
  - 输入：`c.sparePressed` + H 键监听 + 触屏 SPARE 按钮（UIScene）；update 每帧调
    `_maybeStartMercy`/`_tickMercy`/衰减 `_mercyKillVeil`/绘 veil。
  - **波 clear 过滤器**：`!e.dead && !e.departed`（departed 仅 flee 路径置真；spare 让敌走完再 clear）。
  - HUD payload 加 `mercyActive`；遥测加 `mercyActive`/`mercySpares`/`mercyKills`/`mercyFlees`；
    `__test` 钩子 `forceMercy`/`spareEnemy`/`expireMercy`/`mercyState`；`startWave` 重置 mercy 门控。
- `UIScene.js`：左上 SPARE 触屏钮（镜像右上 BURST）+ `_drawSpareBtn`（仅 mercyActive 时显形发光）。
- 设计文档：`docs/superpowers/specs/2026-08-09-mercy-design.md`。

### 验证（实跑，零回归）
- 新增 `tests/mercy.spec.js` **7/7 绿**：① 触发门控（forceMercy 起投降、遥测 mercyActive.phase
  ∈ {kneel,wait}）；② SPARE（H 键：分数↑、拾取物↑、mercySpares=1）；③ KILL（真实战斗管线击杀
  投降敌：mercyKills=1）；④ FLEE（窗口超时：mercyFlees=1）；⑤ 每波一次（mercyDone 门控置真）；
  ⑥ Second Wind 期间不触发（mercyActive 始终 null）；⑦ 真人对局（forceMercy 起投降→H 键 spare，
  端到端零 pageerror）。注册 `mercy` project。
- 官方 CI **5/5 绿**（desktop×3 + 移动横/竖）。
- dev 回归：depth3/laststand4/burst8/variety24（含 bossvariety4/variety2 10）/swarm3/bridge2/
  boss3 **48/48 绿**；magnet 单测中 "drop far outside range stays put" 一次失败为**已知 flaky**
  （Round 14 notes 已记录"magnet 一过性 flaky，单独重跑 3/3 稳过"），单独重跑 magnet **3/3 绿**——
  非本轮回归。
- ASCII+imgstat 抓帧确认：投降帧 cyan=8684（白旗+聚光灯+MERCY 横幅）、realplay 帧 cyan=13669+
  green=855（金/白粒子风暴 + 投降敌轮廓 + 白旗布均可见），全程零 pageerror。

### 趣味评估（创意总监视角）
| 维度 | 改前 | 改后 |
|---|---|---|
| 类型颠覆 | 无（杀光一切的唯一动词） | 投降→三选一，动词被打破 |
| 首次反应 | 无 | 2 秒"等等我该怎么办"真暂停 |
| 波结尾多样性 | 每波同形（全杀） | 残暴/仁慈/黑暗/逃跑 四种可能 |
| 情绪 | 仅支配 | 支配 + 仁慈 + 愧疚 + 错失 |
| 故事性 | "打到 wave N" | "我放了第 7 波所有人" / "我杀了投降的家伙" |
| 火柴人美术用法 | 骨骼动画 | 跪/鞠躬/双手举起 = 骨骼的情绪表达 |
诚实保留：① 趣味是结构/机制代理指标 + 真机遥测 + ASCII 抓帧，**非真人手感**，"伦理暂停"是
基于类型规范的设计推断而非实测；② RNG+每波 1 次+45%+低血量门控 ⇒ 短局可能整局不见一次，
首次触发即是意义，若遥测显示"从不出现"可上调 CHANCE；③ forceMercy 钩子绕过 mercyDone 用于
确定性测试，自然路径仍受每波 gate 约束。

## Round C — 上线后 Steam 评价驱动迭代（Round 3 评价批次）

延续 Round A（音乐）/ Round B（第二 Boss）的评价驱动循环。基于 Round 15 后的现状
（MERCY / OVERDRIVE / 12 敌人 / 12 事件 / 音乐 / 双 Boss / feel pass 2），重新写了一批
20 正面 + 20 负面评价（`docs/post-launch-reviews.md` Round 3）。内容抱怨已基本消失，分布
**迁移到从未修复的"管道/无障碍"层**：

| # | 抱怨簇 | 提及 | 自哪轮反复出现 |
|---|---|---|---|
| **1** | **无按键重绑 / 无选项菜单** | **8/20** | Round 1 起每轮（#10/#11、N3）从未修 |
| 2 | 屏震/动晕 toggle（无障碍） | 4 | Round 1 起（#13、N5）从未修 |
| 3 | 移动端按键（手掌/震动） | 3 | Round 1 起 |

#1+#2 是**同一个缺失功能**（没有设置界面），#1 自发售起每轮都被点"PC table stakes /
in 2026 is wild"却从未动过，影响 100% 键盘玩家——是最高杠杆点。

### Round C 修复：可重绑控制 + 选项菜单 + 屏震 toggle
- **`js/systems/Options.js`**（新，镜像 Meta.js 的 localStorage + 内存缓存避免每帧
  JSON.parse）：7 个可绑动作（left/right/jump/punch/kick/burst/spare），默认逐字复刻原
  布局 `A D W J K L H`（零回归）；重复绑定走 **swap**（不孤立任何键）；`shakeMode`
  full/reduced/off。
- **`js/scenes/OptionsScene.js`**（新）：标题（齿轮钮 + O 键）与暂停浮层（OPTIONS 钮）均可
  调出的模态层。点行→捕获下一按键（DOM `event.code`→Phaser 名）；SHAKE 循环行；
  RESET；BACK/ESC 关闭（捕获中 ESC 取消捕获）。全屏交互背景吸收误点，绝不串到开始/取消暂停。
- **`GameScene.js`**：`_setupKeyboard` 改读 `Options.bindings()`；**方向键 + SPACE 保留为
  固定备用键**（不可重绑，默认与无障碍兼保）；`_shake` 振幅 ×`Options.shakeScale()`
  （1 / 0.4 / 0，off 直短路）；`_togglePause` 在选项打开时 no-op。
- **`TitleScene.js`**：OPTIONS 齿轮钮 + O 键；`start()` 在 optionsOpen 时跳过。
- **`UIScene.js`**：暂停浮层加 OPTIONS 钮（局中重绑）。
- **`main.js`**：注册 OptionsScene；`window.__options_module` 供测试。

### 设计取舍（多解取更享受的）
- 默认逐字不变（CI 5/5 不动）。
- 固定备用键而非"第二可绑槽"：UI 仅 7 行，且玩家永不会把自己锁成不能动。
- 重复 swap 而非拒绝：无错误态、不孤立键，恒保唯一性（测试断言）。
- 屏震 toggle 同菜单顺带修：#2 是同一缺失功能；reduced 40% 保留 juice 又减负。

### 验证（实跑，零回归）
- 新增 `tests/options.spec.js` **10/10**（注册 `options` project）：默认逐字复刻；O 键打开且
  不开始游戏；真实捕获 UI 重绑（点行→按键→持久化）；ESC 关闭；**重绑键走真实战斗管线**
  （U 出拳 11 伤、被释放的 J 无效）；固定备用键在重绑后仍工作（SPACE 跳、LEFT 移）；
  屏震缩放（5→5/2.0/0）；重复 swap；reset 还原；暂停界面可达且关闭不自动恢复。
- 官方 CI **5/5 绿**（桌面×3 + 移动横/竖）。
- 改动键盘后关键 dev 套件全绿：depth 3/3、burst 8/8（含 75s 真人）、laststand 4/4、
  music 4/4、firstminute 11/11。

### 诚实保留
- 绑定按 Phaser 名存储（由物理 `event.code` 解析），跟物理键位（利好 ergo/AZERTY）而非
  产出字符；鼠标侧键/手柄不在范围。
- 新测试顺带暴露（非引入）一个 harness 现象：Playwright `keyboard.press` 在 headless 会
  连发 keydown，游戏边沿触发攻击按"按住连击"语义响应（真机按住 J 本就设计为连击）。测
  跳跃的用例先清场避开战斗锁；真机轻敲只发一次 keydown 不受影响。


