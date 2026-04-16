const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    deanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dean: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

module.exports = mongoose.model('College', collegeSchema);