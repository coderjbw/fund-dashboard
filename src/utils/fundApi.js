/**
 * 基金数据 API（数据来源：东方财富/天天基金）
 */

/**
 * 搜索基金
 * @param {string} keyword - 基金代码或名称关键词
 * @returns {Promise<Array<{code: string, name: string, type: string}>>}
 */
export async function searchFunds(keyword) {
    if (!keyword || keyword.trim().length === 0) return []

    const res = await fetch(`./api/fund-search?m=1&key=${encodeURIComponent(keyword)}`)
    const data = await res.json()

    if (!data.Datas || data.Datas.length === 0) return []

    return data.Datas.map(item => ({
        code: item.CODE,
        name: item.NAME,
        type: item.FundBaseInfo?.FTYPE || item.CATEGORYDESC || '基金',
    }))
}

/**
 * 获取基金历史净值（含每日涨跌幅）
 * @param {string} fundCode - 基金代码
 * @param {number} days - 自然日窗口（30 / 90），返回该窗口内所有交易日数据
 * @returns {Promise<{dailyChange: string, history: Array<{date: string, value: number}>}>}
 */
export async function getFundHistory(fundCode, days = 30) {
    const today = new Date()
    const endDate = today.toISOString().slice(0, 10)
    const startObj = new Date(today)
    startObj.setDate(startObj.getDate() - days)
    const startDate = startObj.toISOString().slice(0, 10)

    const PAGE = 20 // 服务端单页硬上限
    let collected = []
    let total = Infinity

    for (let i = 1; collected.length < total; i++) {
        const res = await fetch(
            `./api/fund-history?fundCode=${fundCode}&pageIndex=${i}&pageSize=${PAGE}&startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`
        )
        const data = await res.json()
        const list = data.Data?.LSJZList || []
        if (typeof data.TotalCount === 'number') total = data.TotalCount
        if (list.length === 0) break
        collected = collected.concat(list)
        if (list.length < PAGE) break
    }

    if (collected.length === 0) {
        return { dailyChange: '0.00', history: [] }
    }

    // API 倒序返回（最新在前），反转为正序
    const reversed = [...collected].reverse()

    const history = reversed.map(item => ({
        date: formatDate(item.FSRQ),
        value: parseFloat(item.JZZZL) || 0,
    }))

    const dailyChange = collected[0].JZZZL || '0.00'

    return { dailyChange, history }
}

/**
 * 获取单只基金的实时估值
 * @param {string} fundCode - 基金代码
 * @returns {Promise<{code, name, estimatedNav, estimatedChange, lastNav, lastNavDate, updateTime, stale?: boolean, diyEstimate?: boolean, coveredWeight?: number}>}
 */
export async function getRealtimeEstimate(fundCode) {
    const res = await fetch(`./api/fund-realtime/${fundCode}.js?rt=${Date.now()}`)
    const text = await res.text()
    // 响应格式为 JSONP：jsonpgz({...});  部分基金（如 QDII）可能返回空串
    const json = text.replace(/^jsonpgz\(/, '').replace(/\);?\s*$/, '').trim()
    let data = null
    try {
        if (json) data = JSON.parse(json)
    } catch {
        data = null
    }

    const today = new Date().toISOString().slice(0, 10)
    const gzDate = typeof data?.gztime === 'string' ? data.gztime.slice(0, 10) : ''

    // 估值时间不是今天（QDII / 停牌 / 数据源异常等），fallback 到最新已披露净值
    if (!data || !data.gszzl || gzDate !== today) {
        // 先拿最新已披露 NAV（DIY 和 stale 都需要）
        const latest = await fetchLatestDisclosedNav(fundCode)
        if (latest && latest.FSRQ) {
            // 若估值日期比历史最新披露日期还新，仍以估值为准
            const useHistory = !gzDate || latest.FSRQ >= gzDate
            if (useHistory) {
                // 尝试档 3：jjcc 十大重仓 × A 股实时价 DIY 估算
                const diy = await tryDIYEstimate(fundCode)
                if (diy) {
                    const lastNavFloat = parseFloat(latest.DWJZ)
                    const changeFloat = parseFloat(diy.estimatedChange)
                    const estNav = Number.isFinite(lastNavFloat) && Number.isFinite(changeFloat)
                        ? (lastNavFloat * (1 + changeFloat / 100)).toFixed(4)
                        : latest.DWJZ
                    const now = new Date()
                    const pad = n => String(n).padStart(2, '0')
                    return {
                        code: fundCode,
                        name: data?.name || '',
                        estimatedNav: estNav,
                        estimatedChange: diy.estimatedChange,
                        lastNav: latest.DWJZ,
                        lastNavDate: latest.FSRQ,
                        updateTime: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
                        diyEstimate: true,
                        coveredWeight: diy.coveredWeight,
                    }
                }
                // 档 3 也拿不到 → 保持原有 stale 兜底
                return {
                    code: fundCode,
                    name: data?.name || '',
                    estimatedNav: latest.DWJZ,
                    estimatedChange: latest.JZZZL || '0.00',
                    lastNav: latest.DWJZ,
                    lastNavDate: latest.FSRQ,
                    updateTime: `${latest.FSRQ} 15:00`,
                    stale: true,
                }
            }
        }
    }

    if (!data) {
        throw new Error(`empty realtime response for ${fundCode}`)
    }

    return {
        code: data.fundcode,
        name: data.name,
        estimatedNav: data.gsz,       // 估算净值
        estimatedChange: data.gszzl,   // 估算涨幅 %
        lastNav: data.dwjz,            // 上一日净值
        lastNavDate: data.jzrq,        // 上一日日期
        updateTime: data.gztime,       // 估算时间 "2026-03-12 14:30"
    }
}

/**
 * 从历史净值端点取最新一条披露净值
 * @param {string} fundCode
 * @returns {Promise<{FSRQ: string, DWJZ: string, JZZZL: string} | null>}
 */
async function fetchLatestDisclosedNav(fundCode) {
    try {
        const histRes = await fetch(
            `./api/fund-history?fundCode=${fundCode}&pageIndex=1&pageSize=1&_t=${Date.now()}`
        )
        const histData = await histRes.json()
        return histData?.Data?.LSJZList?.[0] || null
    } catch {
        return null
    }
}

// 档 3 DIY 估算：会话内缓存持仓（日内不变）
const _holdingsCache = new Map() // fundCode -> { date, stocks }

/**
 * 将股票代码映射到 push2 secid
 * A 股 6 位数字：沪市 6/9 开头 → 1.CODE，深市/创/科/北 → 0.CODE
 * 港股 5 位数字：116.CODE（如 00981 中芯国际）
 * 其他（美股字母代码）暂不支持，返回 null（贡献 0 权重）
 */
function getStockSecid(stockCode) {
    if (!stockCode) return null
    if (/^\d{6}$/.test(stockCode)) {
        if (/^[69]/.test(stockCode)) return `1.${stockCode}`
        return `0.${stockCode}`
    }
    if (/^\d{5}$/.test(stockCode)) {
        return `116.${stockCode}`
    }
    return null
}

/**
 * 档 3：用 jjcc 前十大重仓 × A 股实时涨跌，DIY 估算基金涨跌幅
 * 权重按"占净值比例%"直接使用，未披露仓位按 0 处理（跟原生 gsz 同一套算法）
 * @param {string} fundCode
 * @returns {Promise<{estimatedChange: string, coveredWeight: number} | null>}
 */
async function tryDIYEstimate(fundCode) {
    const today = new Date().toISOString().slice(0, 10)
    let cached = _holdingsCache.get(fundCode)
    if (!cached || cached.date !== today) {
        try {
            const holdings = await getFundHoldings(fundCode)
            cached = { date: today, stocks: holdings.stocks || [] }
            _holdingsCache.set(fundCode, cached)
        } catch {
            return null
        }
    }
    const stocks = cached.stocks
    if (!stocks || stocks.length === 0) return null

    // 提取有 secid 的股票 + 权重
    const entries = stocks
        .map(s => ({
            secid: getStockSecid(s.code),
            weight: parseFloat(String(s.weight || '').replace('%', '')) || 0,
        }))
        .filter(e => e.secid && e.weight > 0)
    if (entries.length === 0) return null

    let priceMap = new Map()
    try {
        const secids = entries.map(e => e.secid).join(',')
        const res = await fetch(`./api/push2-quote?secids=${secids}&_t=${Date.now()}`)
        const data = await res.json()
        const list = data?.data?.diff || []
        for (const item of list) {
            // 用返回的 f13（市场码）+ f12（代码）重建 secid，兼容沪(1)/深(0)/港(116)
            const key = `${item.f13}.${item.f12}`
            const change = parseFloat(item.f3)
            if (Number.isFinite(change)) priceMap.set(key, change)
        }
    } catch {
        return null
    }
    if (priceMap.size === 0) return null

    // 加权：sum(weight% × change%) / 100 = 估算 gszzl%
    let sum = 0
    let coveredWeight = 0
    for (const e of entries) {
        if (priceMap.has(e.secid)) {
            sum += e.weight * priceMap.get(e.secid) / 100
            coveredWeight += e.weight
        }
    }
    if (coveredWeight === 0) return null

    return {
        estimatedChange: sum.toFixed(2),
        coveredWeight: Number(coveredWeight.toFixed(2)),
    }
}

/**
 * 批量拉取场内基金（ETF/LOF）二级市场实时行情。
 * push2 对每个 code 同时探测沪(1.)/深(0.) 前缀，只有真实存在的会命中。
 * 场外基金不返回，天然被过滤掉。
 * @param {string[]} fundCodes
 * @returns {Promise<Map<string, {estimatedNav, estimatedChange, lastNav, updateTime, market}>>}
 */
async function batchGetOnMarketQuotes(fundCodes) {
    const map = new Map()
    if (!fundCodes || fundCodes.length === 0) return map

    // 每个 code 尝试沪深两个前缀，push2 会按存在性过滤
    const secids = fundCodes.flatMap(c => [`1.${c}`, `0.${c}`]).join(',')
    try {
        const res = await fetch(`./api/push2-quote?secids=${secids}&_t=${Date.now()}`)
        const data = await res.json()
        const list = data?.data?.diff || []
        for (const item of list) {
            const code = String(item.f12 || '')
            const gszzl = item.f3 // 涨跌幅 %
            const price = item.f2 // 实时价（作为 estimatedNav 展示）
            const prevClose = item.f18 // 昨收 = 上一日净值
            const tsSec = Number(item.f124) // unix 秒
            if (!code || gszzl == null || price == null) continue
            const dt = tsSec ? new Date(tsSec * 1000) : new Date()
            const pad = n => String(n).padStart(2, '0')
            const updateTime = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
            // 上一交易日日期：粗略取 updateTime 的日期，UI 只在 stale 场景展示
            const lastNavDate = updateTime.slice(0, 10)
            map.set(code, {
                code,
                name: item.f14 || '',
                estimatedNav: String(price),
                estimatedChange: String(gszzl),
                lastNav: prevClose != null ? String(prevClose) : String(price),
                lastNavDate,
                updateTime,
                market: item.f13 === 1 ? 'SH' : 'SZ',
                onMarket: true, // UI 用来打「场内」徽标
            })
        }
    } catch {
        // 静默：失败时全部走场外分支
    }
    return map
}

/**
 * 批量获取多只基金的实时估值
 * - 场内 ETF/LOF：走 push2 拿真·二级市场成交价（不是估算）
 * - 场外基金：走已下线的 gsz 接口 → 回退最新披露净值（stale: true）
 * @param {string[]} fundCodes
 * @returns {Promise<Array>}
 */
export async function batchGetRealtimeEstimates(fundCodes) {
    if (!fundCodes || fundCodes.length === 0) return []

    // 1. 先一次性问 push2 哪些是场内
    const onMarketMap = await batchGetOnMarketQuotes(fundCodes)

    // 2. 剩余的走原有 gsz → history fallback 流程
    const offMarketCodes = fundCodes.filter(c => !onMarketMap.has(c))
    const offMarketResults = await Promise.allSettled(
        offMarketCodes.map(code => getRealtimeEstimate(code))
    )
    const offMarketList = offMarketResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

    // 3. 按原始顺序合并
    const combined = []
    for (const code of fundCodes) {
        if (onMarketMap.has(code)) {
            combined.push(onMarketMap.get(code))
        } else {
            const off = offMarketList.find(x => x.code === code)
            if (off) combined.push(off)
        }
    }
    return combined
}

function formatDate(dateStr) {
    // "2024-03-12" -> "3/12"
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 从 jjcc HTML 中解析前十大重仓股。
 * jjcc 返回形如 `var apidata={ content:"<html...>", arryear:[...], curyear:2026 };`
 * 空持仓时 content 为空字符串。
 *
 * 兼容两种表格样式：
 * - A股：td 有 class='tol' / 'tor'，代码/名称包含在 <a> 中，代码为 6 位数字
 * - QDII/HK/US：td 使用 class='toc'，代码可能是 4-5 位或字母（如 2330 / TSM / 005930），
 *   部分非中概股用 <span> 包裹，无 <a>
 * 为了兼容，按 <td> 位置解析：
 *   0=序号 1=股票代码 2=股票名称 3=最新价 4=涨跌幅 5=相关资讯 6=占净值比例 7=持股数 8=持仓市值
 */
function parseHoldingsHTML(content) {
    if (!content) return { stocks: [], reportDate: '', quarter: '' }
    // 反转义（服务端已经反转义了大部分，但保险再做一次）
    const html = content
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/')
        .replace(/\\n/g, '\n')

    const quarterMatch = html.match(/(\d{4})年(\d)季度股票投资明细/)
    const quarter = quarterMatch ? `${quarterMatch[1]} Q${quarterMatch[2]}` : ''

    const dateMatch = html.match(/截止至：<font[^>]*>([\d-]+)<\/font>/)
    const reportDate = dateMatch ? dateMatch[1] : ''

    // 提取 tbody 内每一行
    const rowRe = /<tr>([\s\S]*?)<\/tr>/g
    const stocks = []
    let m
    while ((m = rowRe.exec(html)) !== null) {
        const row = m[1]
        // 跳过表头
        if (/<th[\s>]/.test(row)) continue

        // 按顺序抽取所有 td 的纯文本内容
        const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => {
            // 去掉标签，压缩空白
            return x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        })

        // 至少 9 列
        if (tds.length < 9) continue
        const code = tds[1]
        const name = tds[2]
        const weight = tds[6]
        const shares = tds[7]
        const marketValue = tds[8]

        // 基础校验：代码非空、名称非空、比例形如 xx.xx%
        if (!code || !name || !/%$/.test(weight)) continue

        stocks.push({ code, name, weight, shares, marketValue })
    }
    return { stocks, reportDate, quarter }
}

/**
 * 从 pingzhongdata 文本中提取 Data_assetAllocation。
 * 结构：
 *   {"series":[{"name":"股票占净比","data":[...]},{"name":"债券占净比",...},{"name":"现金占净比",...},{"name":"净资产","data":[...]}],
 *    "categories":["2025-06-30",...]}
 * 只取最新一期。
 */
function parseAssetAllocation(text) {
    if (!text) return null
    const m = text.match(/var Data_assetAllocation\s*=\s*(\{[\s\S]*?\});/)
    if (!m) return null
    let obj
    try {
        obj = JSON.parse(m[1])
    } catch {
        return null
    }
    const cats = Array.isArray(obj?.categories) ? obj.categories : []
    const idx = cats.length - 1
    if (idx < 0) return null

    const pick = (name) => {
        const s = obj.series?.find(x => x.name === name)
        const v = s?.data?.[idx]
        return typeof v === 'number' ? v : null
    }

    return {
        date: cats[idx],
        stock: pick('股票占净比'),
        bond: pick('债券占净比'),
        cash: pick('现金占净比'),
        netAsset: pick('净资产'), // 亿元
    }
}

/**
 * 获取基金持仓明细
 * @param {string} fundCode
 * @returns {Promise<{stocks: Array, reportDate: string, quarter: string, assetAlloc: {date, stock, bond, cash, netAsset}|null}>}
 */
export async function getFundHoldings(fundCode) {
    const [holdingsRes, pzRes] = await Promise.allSettled([
        fetch(`./api/fund-holdings/${fundCode}?_t=${Date.now()}`).then(r => r.text()),
        fetch(`./api/fund-pingzhong/${fundCode}?_t=${Date.now()}`).then(r => r.text()),
    ])

    // 解析持仓
    let stocks = [], reportDate = '', quarter = ''
    if (holdingsRes.status === 'fulfilled') {
        const text = holdingsRes.value
        // 提取 content 字段
        const contentMatch = text.match(/content\s*:\s*"([\s\S]*?)"\s*,\s*arryear/)
        const content = contentMatch ? contentMatch[1] : ''
        const parsed = parseHoldingsHTML(content)
        stocks = parsed.stocks
        reportDate = parsed.reportDate
        quarter = parsed.quarter
    }

    // 解析资产配置
    let assetAlloc = null
    if (pzRes.status === 'fulfilled') {
        assetAlloc = parseAssetAllocation(pzRes.value)
    }

    return { stocks, reportDate, quarter, assetAlloc }
}
