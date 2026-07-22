import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 6000

// 通用请求头
const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

// 对上游做重试 + 绝对超时，吸收 push2 偶发的 "fetch failed"/"empty reply"
async function fetchWithRetry(url, options = {}, retries = 3, baseBackoffMs = 150, timeoutMs = 4000) {
    let lastErr
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const res = await fetch(url, { ...options, signal: controller.signal })
            clearTimeout(timer)
            return res
        } catch (e) {
            clearTimeout(timer)
            lastErr = e
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, baseBackoffMs * (i + 1)))
            }
        }
    }
    throw lastErr
}

// secids 白名单：仅允许 <市场码>.<字母数字代码> 逗号分隔
// 市场码：1(沪股) / 0(深股/北) / 116(港股) / 105/106/107(美股) 等
const SECIDS_RE = /^(?:\d{1,3}\.[A-Za-z0-9]{2,10})(?:,\d{1,3}\.[A-Za-z0-9]{2,10}){0,199}$/

// ========== API 代理（使用原生 fetch）==========

// 基金搜索
app.get('/api/fund-search', async (req, res) => {
    try {
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : ''
        const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?${queryString}`
        console.log(`[Proxy] fund-search -> ${url}`)
        
        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://so.eastmoney.com/',
            },
        })
        
        const data = await response.text()
        console.log(`[Proxy] fund-search <- ${response.status}, ${data.length} bytes`)
        
        res.set('Content-Type', response.headers.get('content-type') || 'application/json')
        res.send(data)
    } catch (err) {
        console.error('[Proxy Error] fund-search:', err.message)
        res.status(502).json({ error: err.message })
    }
})

// 基金历史净值
app.get('/api/fund-history', async (req, res) => {
    try {
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : ''
        const url = `https://api.fund.eastmoney.com/f10/lsjz?${queryString}`
        console.log(`[Proxy] fund-history -> ${url}`)
        
        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://fundf10.eastmoney.com/',
            },
        })
        
        const data = await response.text()
        console.log(`[Proxy] fund-history <- ${response.status}, ${data.length} bytes`)
        
        res.set('Content-Type', response.headers.get('content-type') || 'application/json')
        res.send(data)
    } catch (err) {
        console.error('[Proxy Error] fund-history:', err.message)
        res.status(502).json({ error: err.message })
    }
})

// 基金持仓明细（前十大重仓股 HTML）
app.get('/api/fund-holdings/:code', async (req, res) => {
    try {
        const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${req.params.code}&topline=10`
        console.log(`[Proxy] fund-holdings -> ${url}`)

        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://fundf10.eastmoney.com/',
            },
        })

        const data = await response.text()
        console.log(`[Proxy] fund-holdings <- ${response.status}, ${data.length} bytes`)

        res.set('Content-Type', 'application/javascript; charset=utf-8')
        res.send(data)
    } catch (err) {
        console.error('[Proxy Error] fund-holdings:', err.message)
        res.status(502).json({ error: err.message })
    }
})

// 基金基础数据（pingzhongdata，含资产配置）
app.get('/api/fund-pingzhong/:code', async (req, res) => {
    try {
        const url = `https://fund.eastmoney.com/pingzhongdata/${req.params.code}.js`
        console.log(`[Proxy] fund-pingzhong -> ${url}`)

        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://fund.eastmoney.com/',
            },
        })

        const data = await response.text()
        console.log(`[Proxy] fund-pingzhong <- ${response.status}, ${data.length} bytes`)

        res.set('Content-Type', 'application/javascript; charset=utf-8')
        res.send(data)
    } catch (err) {
        console.error('[Proxy Error] fund-pingzhong:', err.message)
        res.status(502).json({ error: err.message })
    }
})

// 场内 ETF/LOF 实时行情（push2 二级市场成交价）
// query: ?secids=1.510300,0.159949
// 主 host push2.eastmoney.com 偶尔"empty reply"（IP 限流/短时封禁），
// 用 push2delay.eastmoney.com 作 fallback（15 分钟延迟版，收盘后差别不大）
const PUSH2_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com']

app.get('/api/push2-quote', async (req, res) => {
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : ''
    // 校验 secids 参数：只允许"<市场码>.<字母数字代码>"逗号分隔，防注入
    const secidsMatch = queryString.match(/(?:^|&)secids=([^&]+)/)
    const rawSecids = secidsMatch ? decodeURIComponent(secidsMatch[1]) : ''
    if (!rawSecids || !SECIDS_RE.test(rawSecids)) {
        return res.status(400).json({ error: 'invalid secids' })
    }
    const suffix = `?fltt=2&fields=f2,f3,f12,f13,f14,f18,f124&ut=fa5fd1943c7b386f172d6893dbfba10b&secids=${encodeURIComponent(rawSecids)}`
    let lastErr
    for (const host of PUSH2_HOSTS) {
        const url = `https://${host}/api/qt/ulist.np/get${suffix}`
        try {
            const response = await fetchWithRetry(url, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://quote.eastmoney.com/',
                },
            }, 2, 120, 3500)
            const data = await response.text()
            console.log(`[Proxy] push2-quote via ${host} <- ${response.status}, ${data.length} bytes`)
            res.set('Content-Type', response.headers.get('content-type') || 'application/json')
            res.send(data)
            return
        } catch (err) {
            lastErr = err
            console.warn(`[Proxy] push2-quote ${host} failed: ${err.message}`)
        }
    }
    console.error('[Proxy Error] push2-quote all hosts failed:', lastErr?.message)
    res.status(502).json({ error: lastErr?.message || 'push2 all hosts failed' })
})

// 实时估值
app.get('/api/fund-realtime/:code', async (req, res) => {
    try {
        const url = `https://fundgz.1234567.com.cn/js/${req.params.code}`
        console.log(`[Proxy] fund-realtime -> ${url}`)
        
        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://fund.eastmoney.com/',
            },
        })
        
        const data = await response.text()
        console.log(`[Proxy] fund-realtime <- ${response.status}, ${data.length} bytes`)
        
        res.set('Content-Type', 'application/javascript; charset=utf-8')
        res.send(data)
    } catch (err) {
        console.error('[Proxy Error] fund-realtime:', err.message)
        res.status(502).json({ error: err.message })
    }
})

// ========== 静态文件托管 ==========

app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback
app.get('*path', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`Fund Dashboard running at http://localhost:${PORT}`)
})
