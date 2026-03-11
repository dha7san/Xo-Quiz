import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedOption: { type: String, required: true },
        isCorrect: { type: Boolean, required: true }
    }],
    score: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Submission', submissionSchema);
