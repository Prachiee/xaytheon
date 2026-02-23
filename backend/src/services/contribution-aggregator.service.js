
const consistencyScore = calculateConsistencyScore(contributions);
const cacheService = require('./cache.service');

class ContributionAggregatorService {
    constructor() {
        this.cacheTTL = 60 * 60; // 1 hour (adjust as needed)
    }

    /* =====================================================
       CONTRIBUTION DATA (MOCKED)
    ===================================================== */
    async getContributionData(username) {
        const cacheKey = `github:contributions:${username}`;

        return cacheService.getOrSet(
            cacheKey,
            async () => {
                // Simulate API latency
                await new Promise(res => setTimeout(res, 300));

                const today = new Date();
                const startDate = new Date(today);
                startDate.setDate(today.getDate() - 364);

                const contributions = {};
                let total = 0;
                let maxStreak = 0;
                let currentStreak = 0;
                let runningStreak = 0;

                for (let i = 0; i <= 364; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);

                    const dateStr = d.toISOString().split('T')[0];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const activityChance = isWeekend ? 0.3 : 0.7;

                    let count = 0;
                    if (Math.random() < activityChance) {
                        count = Math.floor(Math.random() * 12);
                        if (Math.random() > 0.9) count += 10;
                    }

                    if (count > 0) {
                        contributions[dateStr] = count;
                        total += count;
                        runningStreak++;
                        maxStreak = Math.max(maxStreak, runningStreak);
                    } else {
                        runningStreak = 0;
                    }
                }

                // Current streak only valid if today has activity
                const todayKey = today.toISOString().split('T')[0];
                currentStreak = contributions[todayKey] ? runningStreak : 0;

                return {
                    contributions,
                    stats: {
                        total,
                        currentStreak,
                        consistencyScore,
                        maxStreak,
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: todayKey
                    }
                };
            },
            this.cacheTTL
        );
    }

    /* =====================================================
       INSIGHTS
    ===================================================== */
    calculateInsights({ contributions = {} }) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayTotals = new Array(7).fill(0);
        const hourTotals = new Array(24).fill(0);

        Object.entries(contributions).forEach(([dateStr, count]) => {
            const date = new Date(dateStr);
            dayTotals[date.getDay()] += count;

            for (let i = 0; i < count; i++) {
                const r = Math.random();
                let hour;

                if (r < 0.7) hour = 9 + Math.floor(Math.random() * 9);       // 9–17
                else if (r < 0.9) hour = 18 + Math.floor(Math.random() * 5); // 18–22
                else hour = Math.floor(Math.random() * 24);

                hourTotals[hour]++;
            }
        });

        const bestDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
        const bestHourIndex = hourTotals.indexOf(Math.max(...hourTotals));

        const intensityDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        Object.values(contributions).forEach(count => {
            if (count === 0) intensityDistribution[0]++;
            else if (count <= 3) intensityDistribution[1]++;
            else if (count <= 6) intensityDistribution[2]++;
            else if (count <= 9) intensityDistribution[3]++;
            else intensityDistribution[4]++;
        });

        return {
            bestDay: {
                name: days[bestDayIndex],
                count: dayTotals[bestDayIndex]
            },
            mostProductiveHour: {
                hour: bestHourIndex,
                count: hourTotals[bestHourIndex]
            },
            dayDistribution: dayTotals,
            hourDistribution: hourTotals,
            intensityDistribution
        };
    }

    // ─── Issue #616: Burnout Detection — Rolling Load & Spike Detection ──────

    /**
     * Compute rolling 14-day load metrics for a contributor.
     * Counts total contributions per day and rolls up to weekly
     * load averages for overload comparison.
     * @param {Object} contributions  - date -> count map from getContributionData
     * @returns {Object} { rollingLoad14d, avgDailyLoad, peakDay, spikeDetected }
     */
    computeRollingLoadMetrics(contributions = {}) {
        const today = new Date();
        const dailyLoad = [];

        for (let d = 13; d >= 0; d--) {
            const day = new Date(today);
            day.setDate(today.getDate() - d);
            const key = day.toISOString().split('T')[0];
            dailyLoad.push({ date: key, count: contributions[key] || 0 });
        }

        const total14d = dailyLoad.reduce((s, d) => s + d.count, 0);
        const avgDailyLoad = parseFloat((total14d / 14).toFixed(2));
        const peakEntry = dailyLoad.reduce((a, b) => b.count > a.count ? b : a, { count: 0, date: null });

        // Spike: any day exceeding 2.5× the 14-day average
        const spikeThreshold = avgDailyLoad * 2.5;
        const spikeDays = dailyLoad.filter(d => d.count > spikeThreshold && d.count > 0);

        return {
            rollingLoad14d: dailyLoad,
            total14d,
            avgDailyLoad,
            peakDay: peakEntry,
            spikeDetected: spikeDays.length > 0,
            spikeDays
        };
    }

    /**
     * Compute weekly load buckets over last 4 weeks.
     * Used for xp-calculator overload signal detection.
     * @param {Object} contributions
     * @returns {Array<number>} weekly totals [week4_ago, week3_ago, week2_ago, last_week]
     */
    computeWeeklyLoadBuckets(contributions = {}) {
        const today = new Date();
        const buckets = [0, 0, 0, 0]; // 4 weeks, newest last

        for (let d = 0; d < 28; d++) {
            const day = new Date(today);
            day.setDate(today.getDate() - d);
            const key = day.toISOString().split('T')[0];
            const weekIdx = 3 - Math.floor(d / 7);
            buckets[weekIdx] += contributions[key] || 0;
        }

        return buckets;
    }
}

module.exports = new ContributionAggregatorService();
