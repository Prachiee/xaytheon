/**
 * Sprint Optimizer Service
 * Uses constraint-solving logic to generate optimal sprint plans.
 */
class SprintOptimizerService {
    /**
     * Generates multiple "Parallel Universe" sprint plans.
     * @param {Array} tasks - List of tasks in the backlog
     * @param {Array} team - List of developers
     */
    async generateSprintPlans(tasks, team) {
        const plans = [];

        // Strategy 1: Maximize Velocity (Speed)
        plans.push({
            id: 'universe_speed',
            name: 'Speed Run',
            description: 'Optimized for fastest completion time.',
            assignments: this.solve(tasks, team, 'speed'),
            probability: 0.85,
            burnoutRisk: 'High'
        });

        // Strategy 2: Maximize Quality/Learning (Balanced)
        plans.push({
            id: 'universe_quality',
            name: 'Quality Focused',
            description: 'Matches tasks to experts to reduce bugs.',
            assignments: this.solve(tasks, team, 'quality'),
            probability: 0.92,
            burnoutRisk: 'Low'
        });

        return plans;
    }

    /**
     * Mock Solver Algorithm (Greedy approach for demo)
     */
    solve(tasks, team, strategy) {
        let assignedTasks = [];
        const availableTeam = JSON.parse(JSON.stringify(team)); // Deep copy using JSON for simplicity

        // Initialize load
        availableTeam.forEach(dev => dev.currentLoad = 0);

        tasks.forEach(task => {
            let bestDev = null;
            let highestScore = -1;

            availableTeam.forEach(dev => {
                let score = 0;

                // Calculate match score based on skills
                const skillMatch = dev.skills[task.type] || 0.1;

                if (strategy === 'speed') {
                    // Favor velocity and skill
                    score = (skillMatch * 0.5) + (dev.velocity * 0.5);
                    // Penalize load slightly
                    score -= (dev.currentLoad * 0.1);
                } else {
                    // Favor exact skill match only
                    score = skillMatch * 2;
                    // Heavy penalty for load to prevent burnout
                    score -= (dev.currentLoad * 0.5);
                }

                if (score > highestScore) {
                    highestScore = score;
                    bestDev = dev;
                }
            });

            if (bestDev) {
                assignedTasks.push({
                    taskId: task.id,
                    taskName: task.name,
                    assignedTo: bestDev.id,
                    devName: bestDev.name,
                    estimatedDays: Math.ceil(task.points / bestDev.velocity)
                });
                bestDev.currentLoad += task.points;
            }
        });

        return assignedTasks;
    }

    /**
     * Recalculates probability and risk for a manual plan.
     */
    async evaluatePlan(assignments, team) {
        let totalRisk = 0;
        let burnoutCount = 0;

        const devLoads = {};
        assignments.forEach(a => {
            if (!devLoads[a.assignedTo]) devLoads[a.assignedTo] = 0;
            devLoads[a.assignedTo] += a.points || 5;
        });

        team.forEach(dev => {
            const load = devLoads[dev.id] || 0;
            const maxCapacity = dev.velocity * 10;
            if (load > maxCapacity) {
                burnoutCount++;
                totalRisk += 20;
            }
        });

        return {
            probability: Math.max(10, 100 - totalRisk),
            burnoutRisk: burnoutCount > 0 ? 'High' : 'Low',
            overloadedDevs: burnoutCount
        };
    }

    // ─── Issue #616: Burnout Detection — At-Risk Detection & Ticket Rebalancing ──

    /**
     * Identify contributors at risk of burnout from sprint assignments
     * and cross-service burnout signals.
     * @param {Array} team - team member objects with { id, name, velocity, currentLoad? }
     * @param {Array} burnoutSignals - per-dev burnout objects { username, riskScore, ... }
     * @returns {Array} atRiskContributors sorted by riskScore desc
     */
    identifyAtRiskContributors(team = [], burnoutSignals = []) {
        const signalMap = new Map(burnoutSignals.map(s => [s.username, s]));

        return team.map(dev => {
            const signal = signalMap.get(dev.id || dev.name) || {};
            const loadRatio = dev.velocity > 0 ? (dev.currentLoad || 0) / (dev.velocity * 10) : 0;

            // Combine workload ratio (40%) + external burnout score (60%)
            const externalScore = signal.riskScore || 0;
            const combinedRisk = parseFloat((loadRatio * 40 + externalScore * 0.6).toFixed(1));

            return {
                id: dev.id || dev.name,
                name: dev.name,
                combinedRisk,
                loadRatio: parseFloat(loadRatio.toFixed(2)),
                currentLoad: dev.currentLoad || 0,
                capacity: dev.velocity * 10,
                externalScore,
                moodTrend: signal.moodTrend || 'stable',
                velocitySignal: signal.velocitySignal || 'STABLE',
                atRisk: combinedRisk >= 50
            };
        }).sort((a, b) => b.combinedRisk - a.combinedRisk);
    }

    /**
     * Auto-rebalance sprint tickets:
     * Move tasks from at-risk / overloaded devs to underloaded devs.
     * @param {Array} assignments  - current task assignments [{ taskId, taskName, assignedTo, devName, points }]
     * @param {Array} atRiskList   - output of identifyAtRiskContributors()
     * @param {Array} team         - full team list
     * @returns {Object} { reassignments, updatedAssignments, rebalanceSummary }
     */
    rebalanceWorkload(assignments = [], atRiskList = [], team = []) {
        const reassignments = [];

        // Build current load map
        const loadMap = {};
        team.forEach(d => { loadMap[d.id || d.name] = { dev: d, load: 0, capacity: (d.velocity || 5) * 10 }; });
        assignments.forEach(a => { if (loadMap[a.assignedTo]) loadMap[a.assignedTo].load += a.points || 5; });

        // Find underloaded devs (load < 70% capacity) not in atRisk set
        const atRiskIds = new Set(atRiskList.filter(d => d.atRisk).map(d => d.id));
        const underloaded = Object.values(loadMap)
            .filter(e => !atRiskIds.has(e.dev.id || e.dev.name) && e.load < e.capacity * 0.7)
            .sort((a, b) => a.load / a.capacity - b.load / b.capacity);

        const updatedAssignments = assignments.map(a => ({ ...a }));

        for (const atRiskId of atRiskIds) {
            const devEntry = loadMap[atRiskId];
            if (!devEntry) continue;

            // Grab the heaviest tasks from the at-risk dev
            const devTasks = updatedAssignments
                .filter(a => a.assignedTo === atRiskId)
                .sort((a, b) => (b.points || 5) - (a.points || 5))
                .slice(0, 2); // move at most 2 tasks at a time

            for (const task of devTasks) {
                const receiver = underloaded.find(u => u.load + (task.points || 5) <= u.capacity);
                if (!receiver) continue;

                const receiverId = receiver.dev.id || receiver.dev.name;
                reassignments.push({
                    taskId: task.taskId,
                    taskName: task.taskName,
                    from: atRiskId,
                    to: receiverId,
                    points: task.points || 5,
                    reason: `${atRiskId} is at burnout risk (combinedRisk=${atRiskList.find(d => d.id === atRiskId)?.combinedRisk})`
                });

                // Update assignment
                const idx = updatedAssignments.findIndex(a => a.taskId === task.taskId);
                if (idx >= 0) { updatedAssignments[idx].assignedTo = receiverId; updatedAssignments[idx].devName = receiver.dev.name; }

                // Update load tracking
                devEntry.load -= (task.points || 5);
                receiver.load += (task.points || 5);
            }
        }

        return {
            reassignments,
            updatedAssignments,
            rebalanceSummary: {
                totalMoved: reassignments.length,
                fromDevs: [...new Set(reassignments.map(r => r.from))],
                toDevs: [...new Set(reassignments.map(r => r.to))]
            }
        };
    }
}

module.exports = new SprintOptimizerService();
