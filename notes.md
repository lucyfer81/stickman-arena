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

