/**
 * 交易时间判断工具
 * 判断当前是否在 A 股交易时段内（工作日 9:30 ~ 15:00，排除节假日）
 */

// 2026 年 A 股休市日（元旦、春节、清明、劳动节、端午、中秋、国庆）
// 每年年底需根据证监会公告更新下一年数据
const HOLIDAYS_2026 = [
    // 元旦
    '2026-01-01', '2026-01-02',
    // 春节（2026 农历正月初一为 2 月 17 日）
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
    '2026-02-21', '2026-02-22',
    // 清明节
    '2026-04-04', '2026-04-05', '2026-04-06',
    // 劳动节
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    // 端午节（2026 端午为 5 月 31 日）
    '2026-05-30', '2026-05-31', '2026-06-01',
    // 中秋节（2026 中秋为 9 月 25 日）
    '2026-09-25', '2026-09-26', '2026-09-27',
    // 国庆节
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    '2026-10-05', '2026-10-06', '2026-10-07',
]

const HOLIDAY_SET = new Set(HOLIDAYS_2026)

/**
 * 判断当前是否在交易时段内
 * @returns {boolean} true = 可以采集
 */
export function isTradeTime() {
    const now = new Date()
    const day = now.getDay()

    // 周六日不交易
    if (day === 0 || day === 6) return false

    // 节假日不交易
    const dateStr = now.toISOString().slice(0, 10)
    if (HOLIDAY_SET.has(dateStr)) return false

    // 交易时段 9:30 ~ 15:00
    const hhmm = now.getHours() * 100 + now.getMinutes()
    if (hhmm < 930 || hhmm >= 1500) return false

    return true
}

/**
 * 判断当天是否为交易日（不考虑时间）
 * @returns {boolean}
 */
export function isTradeDay() {
    const now = new Date()
    const day = now.getDay()
    if (day === 0 || day === 6) return false
    const dateStr = now.toISOString().slice(0, 10)
    if (HOLIDAY_SET.has(dateStr)) return false
    return true
}
