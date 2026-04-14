# Fund Dashboard - 基金投资看板

一个现代化的基金投资数据看板，支持实时估值监控、历史走势分析和智能投资建议。

## 功能特性

- **自选基金管理** - 搜索、添加、删除自选基金，数据本地持久化
- **历史走势图表** - 展示近 30 日涨幅走势，支持多基金对比
- **实时估值监控** - 交易时段每分钟自动刷新，采集日内估值数据
- **智能投资建议** - 基于近 7 日走势分析，给出增投/减持/观望建议
- **基金详情页** - 查看单只基金的详细估值和日内走势
- **深色/浅色主题** - 支持主题切换，跟随系统设置
- **移动端适配** - 响应式设计，支持移动端 H5 访问

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 |
| 构建工具 | Vite 5 |
| 路由 | React Router 7 |
| 样式 | Tailwind CSS 3 |
| 图表 | ECharts 5 |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| 后端代理 | Express 5 |
| 数据来源 | 东方财富 / 天天基金 API |

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 启动前端 (端口 8080)
npm run dev

# 启动后端代理服务器 (端口 3001)
npm run server
```

前端访问：`http://localhost:8080`

### 生产构建

```bash
npm run build
```

## 项目结构

```
fund-dashboard/
├── src/
│   ├── components/           # 公共组件
│   │   └── ThemeToggle.jsx   # 主题切换组件
│   ├── pages/
│   │   ├── Home/             # 首页
│   │   │   ├── index.jsx     # 首页主组件
│   │   │   └── components/
│   │   │       ├── FundList.jsx      # 自选基金列表
│   │   │       ├── FundChart.jsx     # 历史走势图表
│   │   │       ├── RealtimeBoard.jsx # 实时估值看板
│   │   │       └── InvestAdvice.jsx  # 投资建议
│   │   └── FundDetail/       # 基金详情页
│   │       ├── index.jsx
│   │       └── components/
│   │           └── DetailChart.jsx
│   ├── utils/
│   │   ├── fundApi.js        # 基金数据 API 封装
│   │   ├── theme.js          # 主题管理
│   │   ├── tradeTime.js      # 交易时间判断
│   │   └── cn.js             # 类名工具
│   ├── App.jsx               # 应用入口
│   ├── main.jsx              # React 入口
│   └── index.css             # 全局样式
├── server.js                 # Express 代理服务器
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## 功能说明

### 自选基金

- 支持按基金代码或名称搜索
- 自动保存到 localStorage，刷新不丢失
- 点击基金卡片可跳转到详情页

### 实时估值

- 仅在交易时段（工作日 9:30-15:00）自动轮询
- 每分钟采集一个数据点，绘制日内走势图
- 数据缓存到 localStorage，当日有效

### 投资建议

基于以下指标综合分析：
- 近 7 日累计涨幅
- 动量（近 3 日 vs 前 4 日）
- 波动率

给出建议等级：
- **建议增投** - 近期表现强势
- **建议减持** - 近期表现较弱
- **建议观望** - 走势平稳

### 移动端适配

- 导航栏和侧边栏默认折叠，点击展开
- 支持横屏模式查看图表
- 触摸操作优化

## API 代理

由于浏览器跨域限制，项目使用 Express 服务器代理基金数据 API：

- `/api/search` - 搜索基金
- `/api/history/:code` - 获取历史净值
- `/api/realtime/:code` - 获取实时估值

## 配置说明

### 路径别名

```javascript
@ → src/
@components → src/components/
@pages → src/pages/
@utils → src/utils/
```

### 主题配色

在 `tailwind.config.js` 中定义：

- `primary` - 主色调（蓝色系）
- `secondary` - 次要色（绿色系）
- `accent` - 强调色（橙色系）

## 注意事项

1. 实时估值数据来源于第三方 API，仅供参考，不构成投资建议
2. 投资建议基于简单的技术分析，请结合实际情况判断
3. 后端代理服务器需要单独启动

## License

MIT
