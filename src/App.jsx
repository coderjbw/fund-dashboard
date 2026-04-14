// 必须使用 HashRouter 路由，不能使用别的 Router
import { Routes, Route, HashRouter as Router } from 'react-router'
import Home from './pages/Home/index'
import FundDetail from './pages/FundDetail/index'
import { initTheme } from './utils/theme'

// 在 React 渲染前初始化主题
initTheme()

function App() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-foreground transition-colors">
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/fund/:code" element={<FundDetail />} />
                </Routes>
            </Router>
        </div>
    )
}

export default App
