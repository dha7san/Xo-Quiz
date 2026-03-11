import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    question: { type: String, required: true },
    options: {
        type: [String],
        required: true,
        validate: [arrayLimit, '{PATH} exceeds the limit of 4']
    },
    correctAnswer: { type: String, required: true }
}, { timestamps: true });

function arrayLimit(val) {
    return val.length === 4;
}

export default mongoose.model('Question', questionSchema);
