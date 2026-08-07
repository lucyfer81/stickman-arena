# Round 4 — 首分钟留存（onboarding / 奖励节奏 / 进度感）

**前提**：假设玩家只玩 60 秒。目标=首分钟留存，人群=新手+休闲（hardcore 深度不在范围）。

## 首分钟流失诊断（基于 CONFIG 解析推演 + DESIGN.md 真实 persona 遥测）

| 流失点 | 证据 |
|---|---|
| 死时间 | 敌人从墙边走到中场 ~3.2s；波间 1.1s；首分钟 ~15–20% 低活跃。casual 原话："long dead stretches" |
| 无威胁 | casual 60s 满血、hardcore 90s 零伤害（DESIGN.md 表）→ 无紧张感 |
| 引导只标注 | 提示芯片用后变暗/16s 或 wave2 消失；AFK 新手没人教，30s 仅掉 36 血缓慢流血 |
| 最爽内容后置 | boss=wave5（~2–3 分钟）、skins（ember=wave5/toxic=100杀/royal=5000分/gold=x20）首分钟全摸不到 |
| 元进度局内不可见 | 生涯/skins/daily 只在标题或结算页；首分钟最关键时看不到长期钩子 |

留下来的钩子：打击感（首命中即有 hit-pause/震屏/粒子）、combo 反馈（~10s 拿 x5）、视觉完成度、清波短目标。

## 红线（不动）
boss 仍在 wave5；3 难度 / skins / daily 逻辑不改；punch/kick/leaper/brute/runner 战斗深度保留。

## 五项改动

1. **消灭死时间**（`GameScene.spawnOne/startWave` + 波间）：wave1–3 敌人出生点从墙边内移到距中场 ±280px 的固定带（`WALL_LEFT+300` / `WALL_RIGHT-300`），首接触 ~3.2s→~1.5s；前 3 波波间 1.1s→0.7s、出生间隔 `rand(0.3,0.65)`→`rand(0.22,0.45)`；wave1 首敌 spawnTimer 0.3→0.15。wave4+ 仍走墙边。
2. **早期轻度施压**（`GameScene._applyScaling`）：wave1–3 的 `aggrMul` 加 `Math.max(0.95, …)` 下限（原 floor 0.8）。敌人出招更快、lunge 更猛（aggr 驱动 lunge），站桩/瞎 mash 的休闲在 60s 内会挨几下，但会玩的靠移动仍可无伤——不破坏深度。
3. **引导会教学**（`UIScene` 新增 teach 层 + `GameScene.onboard.firstHit`）：①wave1–2 首敌接近且未首命中时，在敌人头顶画下指箭头+"J/PUNCH"（touch 用字面 PUNCH），首命中消失；②敌人血量 ≤ 踢伤害时提示"K/KICK 收割"；③AFK 兜底：wave1 首敌贴身 1.6s 未出手则居中脉冲大字"PRESS J / TAP PUNCH"。保留原桌面芯片。
4. **首分钟高潮**：①当局限**首杀**（非 boss）升级为"FIRST BLOOD"横幅 + 慢镜 0.3s + 大震屏（~3–5s 触发，最廉价记忆点）；②新敌人变体 **vanguard**（金色、1.25×、50hp），仅 wave2 首刷出现，给一个 6–8s 的小决斗高潮。不动 wave5 boss。
5. **元进度局内可见**（`Meta.nextUnlock` + `UIScene` 目标条 + `GameOverScene`）：HUD 常驻小字"NEXT → reach wave 5 · EMBER skin"（读 Meta，按当前进度滚动显示下一个未解锁）；结算页加"Tomorrow: [明日 daily 修饰器]"+"X/target → LABEL skin"进度，驱动次日回访。无后端。

## 非目标（YAGNI）
不加新场景/新货币/动 boss 机制/加难度档/加后端。

## 验证
本环境跑不了 Playwright（缺浏览器系统库、无 sudo）。代码按构造不破坏现有断言（`onboard.*` 标志保留、`spawned.leaper` 不受影响、qa-regression 敌人间距 >8px 仍成立、`_checkComboTier` 不动）。新增 `tests/retention.spec.js` 覆盖：vanguard 仅 wave2 首刷、首杀触发 FIRST BLOOD、目标条渲染、死时间缩短（首接触时序）。`npm test` 需在可跑浏览器的环境执行。
