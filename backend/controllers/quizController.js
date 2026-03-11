import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';

export const getActiveQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isActive: true });
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
    }
};

export const startQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;

        // Check if quiz exists and is active
        const quiz = await Quiz.findById(quizId);
        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }

        // Check if user already submitted
        const existingSubmission = await Submission.findOne({ userId: req.user.id, quizId });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Fetch questions and scramble them
        const questions = await Question.find({ quizId }).select('-correctAnswer');

        // Simple Fisher-Yates array shuffle for questions
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        // Also randomize options for each question
        const randomizedQuestions = questions.map(q => {
            const qObj = q.toObject();
            for (let i = qObj.options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qObj.options[i], qObj.options[j]] = [qObj.options[j], qObj.options[i]];
            }
            return qObj;
        });

        res.json({ quiz, questions: randomizedQuestions });
    } catch (error) {
        res.status(500).json({ message: 'Error starting quiz', error: error.message });
    }
};

export const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers } = req.body; // answers is an array of { questionId, selectedOption }

        // Check if user already submitted
        const existingSubmission = await Submission.findOne({ userId: req.user.id, quizId });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        const questions = await Question.find({ quizId });

        let score = 0;
        const evaluatedAnswers = answers.map(ans => {
            const question = questions.find(q => q._id.toString() === ans.questionId);
            const isCorrect = question && question.correctAnswer === ans.selectedOption;
            if (isCorrect) score += 1; // 1 point per correct answer

            return {
                questionId: ans.questionId,
                selectedOption: ans.selectedOption,
                isCorrect
            };
        });

        // Create Submission
        const submission = await Submission.create({
            userId: req.user.id,
            quizId,
            answers: evaluatedAnswers,
            score
        });

        // Do not update the global user score immediately anymore; 
        // leaderboard is calculated dynamically below from published quizzes.

        res.status(201).json({ message: 'Quiz submitted successfully. Results will be published later.', total: questions.length, submission });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting quiz', error: error.message });
    }
};

export const getLeaderboard = async (req, res) => {
    try {
        const submissions = await Submission.find()
            .populate('quizId', 'resultsPublished')
            .populate('userId', 'name email role');

        // Filter submissions to only include those from published quizzes
        const publishedSubmissions = submissions.filter(s =>
            s.quizId && s.quizId.resultsPublished === true &&
            s.userId && s.userId.role === 'user'
        );

        const userScores = {};

        publishedSubmissions.forEach(sub => {
            const uId = sub.userId._id.toString();
            if (!userScores[uId]) {
                userScores[uId] = {
                    _id: uId,
                    name: sub.userId.name,
                    score: 0
                };
            }
            userScores[uId].score += sub.score;
        });

        const leaderboard = Object.values(userScores)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
    }
};

export const getMyResults = async (req, res) => {
    try {
        const submissions = await Submission.find({ userId: req.user.id })
            .populate('quizId', 'title resultsPublished');

        const publishedSubmissions = submissions.filter(s => s.quizId && s.quizId.resultsPublished);

        res.json(publishedSubmissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your results', error: error.message });
    }
};
