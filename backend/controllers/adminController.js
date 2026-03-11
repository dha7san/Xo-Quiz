import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';

export const createQuiz = async (req, res) => {
    try {
        const { title, duration, startTime } = req.body;
        const quiz = await Quiz.create({
            title,
            duration,
            startTime
        });
        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quiz', error: error.message });
    }
};

export const addQuestion = async (req, res) => {
    try {
        const { quizId, question, options, correctAnswer } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const newQuestion = await Question.create({
            quizId,
            question,
            options,
            correctAnswer
        });

        res.status(201).json(newQuestion);
    } catch (error) {
        res.status(500).json({ message: 'Error adding question', error: error.message });
    }
};

export const getResults = async (req, res) => {
    try {
        const submissions = await Submission.find({})
            .populate('userId', 'name email score')
            .populate('quizId', 'title')
            .sort({ score: -1 }); // Sort by highest score

        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching results', error: error.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

export const publishResults = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.resultsPublished = true;
        await quiz.save();
        res.json({ message: 'Results published successfully', quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error publishing results', error: error.message });
    }
};
