# Situation Monitor - Development Checkpoint (2026-03-02)

## 当前运行状态
- **本地地址**: `http://localhost:5173`
- **核心逻辑**: 已实现多阶段数据刷新机制（Critical/Secondary/Tertiary），支持 GDELT 和 30+ RSS 源。
- **代理机制**: 使用 `fetchWithProxy` 配合重试逻辑处理跨域与网络超时。

## 待处理问题 (To-Do List)
1. **[i18n] 全面汉化**: 将 UI 界面、面板标题、地图热点描述全部替换为中文；
2. **[Translation] 内容翻译**: 在数据接入层增加自动翻译逻辑（拟调用 LLM 或翻译 API），确保新闻摘要和内容以中文展示；
3. **[Core] Finnhub 稳定性**: 处理 429 频率限制问题，增加请求排队或指数退避逻辑；
4. **[Core] GDELT 容错**: 修复 GDELT 522 错误，增加 RSS 备选源，优化 URL 提取正则表达式；
5. **[Store] 状态同步**: 解决 Markets Store 在面板刷新时的延迟与不同步问题；
6. **[Resilience] 持久化**: 增强 Store 的本地缓存能力，确保断网或刷新后态势数据不丢失。

## 架构计划
1. **i18n 配置文件化**: 将 `src/lib/config/` 下的硬编码文字提取到语言包中；
2. **集成翻译中间件**: 在 `src/lib/services/ServiceClient.ts` 或数据解析层（Parser）插入翻译钩子；
3. **宏观数据增强**: 集成 FRED API Key 获取更全面的全球经济指标。

## 快速恢复命令
> "读取 E:\works\situation-monitor\CHECKPOINT.md 并继续汉化与翻译任务。"
