/**
 * Blame Analyzer Service
 * Uses NLP to identify "bug genesis" points and potential regression sources.
 */
class BlameAnalyzerService {
    /**
     * Analyzes commit messages to find bug-fix patterns.
     * @param {Array} timeline 
     */
    async analyzeBugGenesis(timeline) {
        const bugFixCommits = timeline.filter(commit =>
            /fix|bug|issue|resolve|patch|hotfix|revert/i.test(commit.message)
        );

        const hotspots = {};

        bugFixCommits.forEach(commit => {
            commit.changes.forEach(change => {
                if (!hotspots[change.file]) {
                    hotspots[change.file] = { count: 0, lastFix: null };
                }
                hotspots[change.file].count++;
                hotspots[change.file].lastFix = commit.date;
            });
        });

        return {
            bugFixCount: bugFixCommits.length,
            hotspots: Object.entries(hotspots)
                .map(([file, data]) => ({ file, ...data }))
                .sort((a, b) => b.count - a.count), // Most fragile files first
            fixes: bugFixCommits
        };
    }

    /**
     * AI-based regression detection (Simulated).
     * Attempts to find which commit likely introduced the bug being fixed.
     */
    async traceRegressionOrigin(fixCommitHash) {
        // Logic: Find the last modification to the same files BEFORE the fix
        return {
            fixCommit: fixCommitHash,
            suspectCommit: 'e5f6g7h', // Mock suspect
            confidence: '85%',
            reason: "Modified 'auth.service.js' 5 days prior to the fix."
        };
    }
}

module.exports = new BlameAnalyzerService();
