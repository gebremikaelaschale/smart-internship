const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Task = require('../models/Task');

// 1. አዲስ Task መስጠት (Employer Only)
router.post('/', auth, async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.json(task);
    } catch (err) { res.status(500).send("Task assignment failed."); }
});

// 2. የተማሪውን Taskዎች ማምጣት
router.get('/:appId', auth, async (req, res) => {
    try {
        const tasks = await Task.find({ application: req.params.appId }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) { res.status(500).send("Error fetching tasks."); }
});

module.exports = router;