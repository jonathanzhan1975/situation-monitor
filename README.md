# Situation Monitor (情势监控器)

一个集成情报分析、新闻聚合与全球地理空间可视化的实时情报仪表盘应用。该项目旨在通过自动化分析多源情报，帮助用户快速捕捉全球地缘政治、经济及科技领域的关键动态。

## 核心功能

*   **实时情报聚合**：从 30 多个权威 RSS 源、GDELT 全球事件数据库、美联储经济数据 (FRED) 及加密货币市场 (CoinGecko) 实时抓取数据。
*   **智能情报分析**：
    *   **模式关联 (Correlation)**：自动识别跨新闻源的相关事件，发现潜在的趋势。
    *   **叙事追踪 (Narrative Tracking)**：监测特定话题从边缘讨论演变为核心主流叙事的过程。
    *   **核心实体检测 (Main Character)**：计算并识别当前情报流中的核心人物与组织。
*   **全球态势图**：使用 D3.js 驱动的交互式地图，标注地缘政治热点（Hotspots）、冲突区域及战略节点。
*   **高可用架构**：内置缓存管理、熔断机制 (Circuit Breaker) 和请求去重；采用三级分层刷新策略 (Critical/Secondary/Tertiary)，确保系统在极端数据流量下的韧性。

## 技术栈

*   **前端框架**：SvelteKit 2.0 (基于 Svelte 5 $state/$derived runes)
*   **编程语言**：TypeScript (严格模式)
*   **样式处理**：Tailwind CSS (内置自定义深色主题)
*   **数据可视化**：D3.js (地图与图表渲染)
*   **测试框架**：Vitest (单元测试) & Playwright (端到端测试)
*   **构建部署**：静态适配器 (@sveltejs/adapter-static)，支持部署至 GitHub Pages
*   **外部依赖**：CORS Proxy (Cloudflare Worker) 用于 RSS 解析

## 目录结构

```text
src/lib/
├── analysis/    # 情报关联、叙事追踪及核心实体检测逻辑
├── api/         # 外部 API 集成 (FRED, Markets, News, Leaders)
├── components/  # Svelte 组件 (Layout, Panels, Modals)
├── config/      # 全局配置 (feeds.ts, keywords.ts, map.ts 等)
├── services/    # 韧性层 (ServiceClient 统一管理缓存、熔断、去重)
├── stores/      # 状态管理 (新闻流、市场行情、刷新编排)
└── types/       # TypeScript 接口定义

tests/
├── e2e/         # Playwright 端到端测试脚本
└── unit/        # (位于 src/lib/ 下的 *.test.ts) 单元测试
```

## 快速开始

### 1. 环境准备
确保已安装 Node.js (建议 v18+)。

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
复制 `.env.example` 为 `.env` 并根据需要填写 API Key（如 FRED API Key）。
```bash
cp .env.example .env
```

### 4. 开发与运行
```bash
npm run dev          # 启动开发服务器 (localhost:5173)
npm run build        # 构建静态文件 (输出至 /build)
npm run test:unit    # 运行逻辑单元测试
npm run test:e2e     # 运行端到端测试 (需先启动预览服务器)
```

## 测试数据说明
本项目在 `src/lib/analysis/` 的测试文件中包含模拟新闻数据，可用于验证分析引擎。生产环境下，系统将根据 `src/lib/config/feeds.ts` 中的预设源实时抓取。

## 部署信息
项目通过 GitHub Actions 自动构建并部署，基础路径配置为 `/situation-monitor`。

## 贡献指南

1.  **分支策略**：请在功能分支 (feature branch) 上进行开发，避免直接提交至主分支。
2.  **代码清理**：提交 PR 前，建议运行 `code-simplifier` 代理（如果可用）以清理代码。
