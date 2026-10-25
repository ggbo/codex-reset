# Codex Reset Radar

一个根据 Tibo（`@thsottiaux`）公开动态识别 Codex 重置信号并计算时间窗口的轻量站点。

## 运行

需要 Node.js 20+：

```bash
npm start
```

打开 <http://localhost:8787>。

## GitHub Pages

仓库 `ggbo/codex-reset` 的 `main` 分支包含 Pages 工作流，静态站点内容位于 `public/`。如果 GitHub 账户尚未启用 Pages，需要在仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**；启用后，下一次推送会发布到 <https://ggbo.github.io/codex-reset/>。当前还准备了 `gh-pages` 分支作为静态快照。

默认数据源是公开的 `https://codex-reset.com/api/feed`，它提供已经整理好的 Tibo 公开动态与事件记录。为了方便独立部署，服务支持通过 `FEED_URL` 替换成自己的抓取器；网络不可用时会自动使用 `data/seed-feed.json`。

页面每 60 秒重新读取公开 feed，并直接校验允许浏览器跨域访问的雷达站、Codex Reset Watch 和 LimitDigest；回到页面时也会刷新。无需等待 Pages 重新部署即可识别新发布的 Day 记录。Reset Tracker 在构建和本地服务端参与校验。跨站内容按 Day 编号和关联帖子 ID 匹配，至少两个来源一致才计为已确认；预告、银行式重置卡和完成确认分开处理。

Pages 定时工作流计划约每 15 分钟更新构建快照（`public/feed.json`、`public/source-check.json`），GitHub 调度可能延迟，不能保证固定间隔。浏览器直读失败时会保留已确认记录，使用快照并标记降级；所有显示时刻均为公开帖子时间，不代表每个账号的后台到账时刻。

```bash
FEED_URL=https://your-feed.example/api/tibo npm start
```

## 预测逻辑

- 先排除 `banked reset`，只把全球重置放进节奏样本。
- 识别 `reset`、`today`、`tomorrow`、`within N hours`、`before 10am PST` 等公开措辞。
- 有明确时间窗口时标记为强信号（24 小时 93%）；只有未来重置承诺时标记为预告（24 小时 83%）。
- 没有活跃信号时，使用最近最多 8 个完整重置间隔的中位数，按指数到达模型估算 24/48 小时概率。

这是社区统计工具，不读取任何 OpenAI 账户、额度或个人用量。
