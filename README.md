# Codex Reset Radar

一个根据 Tibo（`@thsottiaux`）公开动态识别 Codex 重置信号并计算时间窗口的轻量站点。

## 运行

需要 Node.js 20+：

```bash
npm start
```

打开 <http://localhost:8787>。

默认数据源是公开的 `https://codex-reset.com/api/feed`，它提供已经整理好的 Tibo 公开动态与事件记录。为了方便独立部署，服务支持通过 `FEED_URL` 替换成自己的抓取器；网络不可用时会自动使用 `data/seed-feed.json`。

```bash
FEED_URL=https://your-feed.example/api/tibo npm start
```

## 预测逻辑

- 先排除 `banked reset`，只把全球重置放进节奏样本。
- 识别 `reset`、`today`、`tomorrow`、`within N hours`、`before 10am PST` 等公开措辞。
- 有明确时间窗口时标记为强信号（24 小时 93%）；只有未来重置承诺时标记为预告（24 小时 83%）。
- 没有活跃信号时，使用最近最多 8 个完整重置间隔的中位数，按指数到达模型估算 24/48 小时概率。

这是社区统计工具，不读取任何 OpenAI 账户、额度或个人用量。

