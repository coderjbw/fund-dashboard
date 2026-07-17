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

    const res = await fetch(`/api/fund-search?m=1&key=${encodeURIComponent(keyword)}`)
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
            `/api/fund-history?fundCode=${fundCode}&pageIndex=${i}&pageSize=${PAGE}&startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`
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
 * @returns {Promise<{code, name, estimatedNav, estimatedChange, lastNav, lastNavDate, updateTime, stale?: boolean}>}
 */
export async function getRealtimeEstimate(fundCode) {
    const res = await fetch(`/api/fund-realtime/${fundCode}.js?rt=${Date.now()}`)
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
        try {
            const histRes = await fetch(
                `/api/fund-history?fundCode=${fundCode}&pageIndex=1&pageSize=1&_t=${Date.now()}`
            )
            const histData = await histRes.json()
            const latest = histData?.Data?.LSJZList?.[0]
            if (latest && latest.FSRQ) {
                // 若估值日期比历史最新披露日期还新，仍以估值为准；否则用历史净值
                const useHistory = !gzDate || latest.FSRQ >= gzDate
                if (useHistory) {
                    return {
                        code: fundCode,
                        name: data?.name || '',
                        estimatedNav: latest.DWJZ,
                        estimatedChange: latest.JZZZL || '0.00',
                        lastNav: latest.DWJZ,
                        lastNavDate: latest.FSRQ,
                        // 使用披露日期的日期部分 + 收盘时间占位，供 UI 时间显示
                        updateTime: `${latest.FSRQ} 15:00`,
                        stale: true,
                    }
                }
            }
        } catch {
            // 忽略 fallback 错误，继续走原始数据
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
 * 批量获取多只基金的实时估值
 * @param {string[]} fundCodes
 * @returns {Promise<Array>}
 */
export async function batchGetRealtimeEstimates(fundCodes) {
    const results = await Promise.allSettled(
        fundCodes.map(code => getRealtimeEstimate(code))
    )
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
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
        fetch(`/api/fund-holdings/${fundCode}?_t=${Date.now()}`).then(r => r.text()),
        fetch(`/api/fund-pingzhong/${fundCode}?_t=${Date.now()}`).then(r => r.text()),
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
