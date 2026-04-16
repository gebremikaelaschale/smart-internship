const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

module.exports = mongoose.model('Department', departmentSchema);