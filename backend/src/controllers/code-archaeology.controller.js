const timeMachine = require('../services/git-time-machine.service');
const blameAnalyzer = require('../services/blame-analyzer.service');

exports.getTimeline = async (req, res) => {
    try {
        const timeline = await timeMachine.getTimeline();
        res.json({ success: true, data: timeline });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBlameAnalysis = async (req, res) => {
    try {
        const timeline = await timeMachine.getTimeline();
        const analysis = await blameAnalyzer.analyzeBugGenesis(timeline);
        res.json({ success: true, data: analysis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.traceRegression = async (req, res) => {
    const { commitHash } = req.params;
    try {
        const trace = await blameAnalyzer.traceRegressionOrigin(commitHash);
        res.json({ success: true, data: trace });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
