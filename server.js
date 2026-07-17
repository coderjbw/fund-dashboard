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
