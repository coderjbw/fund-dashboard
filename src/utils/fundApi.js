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
 * @returns {Promise<{code, name, estimatedNav, estimatedChange, lastNav, lastNavDate, updateTime}>}
 */
export async function getRealtimeEstimate(fundCode) {
    const res = await fetch(`/api/fund-realtime/${fundCode}.js?rt=${Date.now()}`)
    const text = await res.text()
    // 响应格式为 JSONP：jsonpgz({...});
    const json = text.replace(/^jsonpgz\(/, '').replace(/\);?\s*$/, '')
    const data = JSON.parse(json)
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
