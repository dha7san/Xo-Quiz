import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import QuizState from '../models/QuizState.js';
import { io } from '../index.js';

// Helper to find actual Quiz document from either an ID or a human-readable Code
const resolveQuiz = async (idOrCode) => {
    if (!idOrCode) return null;
    console.log(`🔍 Resolving quiz for identifier: ${idOrCode}`);
    
    if (mongoose.Types.ObjectId.isValid(idOrCode)) {
        const quiz = await Quiz.findById(idOrCode);
        if (quiz) {
            console.log(`✅ Quiz found by ID: ${quiz.title} (${quiz._id})`);
            return quiz;
        }
    }
    
    // Case-insensitive search for the quiz code
    const quizByCode = await Quiz.findOne({ 
        quizCode: { $regex: new RegExp(`^${idOrCode.trim()}$`, 'i') } 
    });
    
    if (quizByCode) {
        console.log(`✅ Quiz found by Code: ${quizByCode.title} (${quizByCode._id})`);
    } else {
        console.warn(`❌ Quiz NOT FOUND for identifier: ${idOrCode}`);
    }
    
    return quizByCode;
};


export const getActiveQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isActive: true });
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
    }
};

export const getPublishedLeaderboards = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ leaderboardPublished: true }).select('title _id');
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching published leaderboards', error: error.message });
    }
};

export const verifyQuizCode = async (req, res) => {
    try {
        const { quizCode } = req.body;
        if (!quizCode) return res.status(400).json({ message: 'Quiz code is required' });

        const quiz = await resolveQuiz(quizCode);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Invalid Quiz Code or quiz is no longer active.' });
        }

        res.json({ quizId: quiz._id });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying quiz code', error: error.message });
    }
};

// Called on page load — just fetches quiz info and checks if user is resuming
export const getQuizInfo = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        
        const actualQuizId = quiz._id;

        // Check if user already submitted
        const existingSubmission = await Submission.findOne({ userId: req.user.id, quizId: actualQuizId });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Check for existing saved state (user is resuming)
        const savedState = await QuizState.findOne({ userId: req.user.id, quizId: actualQuizId });

        if (savedState) {
            // Calculate remaining time based on when the attempt started
            const attemptElapsedSeconds = Math.floor((Date.now() - savedState.startedAt.getTime()) / 1000);
            let timeRemaining = Math.max(0, (quiz.duration * 60) - attemptElapsedSeconds);

            // If time has fully expired, auto-submit whatever they had
            if (timeRemaining <= 0) {
                let score = 0;
                const questionsList = await Question.find({ quizId: actualQuizId });
                const answersObj = savedState.answers ? Object.fromEntries(savedState.answers.entries()) : {};

                const evaluatedAnswers = Object.keys(answersObj).map(qId => {
                    const question = questionsList.find(q => q._id.toString() === qId);
                    const isCorrect = question && question.correctAnswer === answersObj[qId];
                    if (isCorrect) score += 1;
                    return { questionId: qId, selectedOption: answersObj[qId], isCorrect };
                });

                await Submission.create({
                    userId: req.user.id, quizId: actualQuizId,
                    answers: evaluatedAnswers, score,
                    isSuspicious: true, tabSwitches: 0, fullscreenExits: 0
                });

                await QuizState.findOneAndDelete({ userId: req.user.id, quizId: actualQuizId });
                return res.status(403).json({ message: 'Your quiz time has expired. It has been automatically submitted.' });
            }

            // User is resuming — return saved answers + questions + time
            const answersObj = savedState.answers ? Object.fromEntries(savedState.answers.entries()) : {};
            const questions = await Question.find({ quizId: actualQuizId }).select('-correctAnswer');

            return res.json({
                quiz, questions,
                savedState: { answers: answersObj, timeRemaining },
                status: 'resuming'
            });
        }

        // Fresh quiz — just return quiz info (no questions yet, no state created)
        return res.json({
            quiz,
            questions: [],
            savedState: null,
            status: 'new'
        });
    } catch (error) {
        console.error('Error in getQuizInfo:', error);
        res.status(500).json({ message: 'Error fetching quiz info', error: error.message });
    }
};

// Called when user clicks "Start Quiz" — creates QuizState and returns scrambled questions
export const startQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);
        
        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        const actualQuizId = quiz._id;

        // Check if user already submitted
        const existingSubmission = await Submission.findOne({ userId: req.user.id, quizId: actualQuizId });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // If they already have a state, they should be resuming via getQuizInfo, not starting again
        const existingState = await QuizState.findOne({ userId: req.user.id, quizId: actualQuizId });
        if (existingState) {
            return res.status(400).json({ message: 'Quiz already started. Please resume.' });
        }

        // Check if quiz has started
        if (quiz.startTime) {
            const nowMs = Date.now();
            const startTimeMs = new Date(quiz.startTime).getTime();
            if (nowMs < startTimeMs) {
                return res.status(403).json({ message: 'This quiz has not started yet.' });
            }
        }

        // Fetch and scramble questions
        let questions = await Question.find({ quizId: actualQuizId }).select('-correctAnswer');

        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        questions = questions.map(q => {
            const qObj = q.toObject();
            for (let i = qObj.options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qObj.options[i], qObj.options[j]] = [qObj.options[j], qObj.options[i]];
            }
            return qObj;
        });

        // Create QuizState — timer officially starts NOW
        await QuizState.create({
            userId: req.user.id, quizId: actualQuizId,
            answers: {},
            startedAt: Date.now(),
            timeRemaining: quiz.duration * 60,
            lastSavedAt: Date.now()
        });

        res.json({ quiz, questions });
    } catch (error) {
        console.error('Error in startQuiz:', error);
        res.status(500).json({ message: 'Error starting quiz', error: error.message });
    }
};

export const saveQuizState = async (req, res) => {
    try {
        const { quizId, answers, timeRemaining } = req.body;
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        await QuizState.findOneAndUpdate(
            { userId: req.user.id, quizId: quiz._id },
            { 
                answers, 
                timeRemaining,
                lastSavedAt: Date.now()
            },
            { upsert: true, new: true }
        );

        res.json({ message: 'Quiz state saved' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving quiz state', error: error.message });
    }
};

export const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers, isSuspicious, tabSwitches, fullscreenExits } = req.body; 
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        const actualQuizId = quiz._id;

        const previousSubmissionsCount = await Submission.countDocuments({ userId: req.user.id, quizId: actualQuizId });
        const questions = await Question.find({ quizId: actualQuizId });

        let score = 0;
        const evaluatedAnswers = answers.map(ans => {
            const question = questions.find(q => q._id.toString() === ans.questionId);
            const isCorrect = question && question.correctAnswer === ans.selectedOption;
            if (isCorrect) score += 1;

            return {
                questionId: ans.questionId,
                selectedOption: ans.selectedOption,
                isCorrect
            };
        });

        // Create Submission
        const submission = await Submission.create({
            userId: req.user.id,
            quizId: actualQuizId,
            answers: evaluatedAnswers,
            score,
            isSuspicious: isSuspicious || false,
            tabSwitches: tabSwitches || 0,
            fullscreenExits: fullscreenExits || 0,
            attemptNumber: previousSubmissionsCount + 1
        });

        // Delete any saved state the user had
        await QuizState.findOneAndDelete({ userId: req.user.id, quizId: actualQuizId });

        res.status(201).json({ message: 'Quiz submitted successfully. Results will be published later.', total: questions.length, submission });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting quiz', error: error.message });
    }
};

export const getLeaderboard = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await resolveQuiz(quizId);
        
        if (!quiz || !quiz.leaderboardPublished) {
            return res.status(403).json({ message: 'Leaderboard is not published for this quiz yet.' });
        }

        const submissions = await Submission.find({ quizId: quiz._id })
            .populate('userId', 'name email role');

        const publishedSubmissions = submissions.filter(s =>
            s.userId && s.userId.role === 'user'
        );

        // Group by user and take highest score for each user
        const bestScoresMap = {};
        for (const sub of publishedSubmissions) {
            const uId = sub.userId._id.toString();
            if (!bestScoresMap[uId] || bestScoresMap[uId].score < sub.score) {
                bestScoresMap[uId] = sub;
            }
        }

        const leaderboard = Object.values(bestScoresMap)
            .map(sub => ({
                _id: sub.userId._id.toString(),
                name: sub.userId.name,
                score: sub.score
            }))
            .sort((a, b) => b.score - a.score);

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

        // Fetch question counts for each unique quizId in published submissions
        const quizIds = [...new Set(publishedSubmissions.map(s => s.quizId._id))];
        const questionCounts = await Promise.all(quizIds.map(async (qId) => {
            const count = await Question.countDocuments({ quizId: qId });
            return { [qId]: count };
        }));

        const countsMap = Object.assign({}, ...questionCounts);

        const resultsWithCounts = publishedSubmissions.map(sub => {
            const subObj = sub.toObject();
            return {
                ...subObj,
                totalQuestions: countsMap[sub.quizId._id] || 0
            };
        });

        res.json(resultsWithCounts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your results', error: error.message });
    }
};

// Real-time flag reporting — called from frontend on each suspicious activity
export const reportFlag = async (req, res) => {
    try {
        const { quizId, flagType } = req.body;
        const userId = req.user.id;
        
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        const actualQuizId = quiz._id;

        const validTypes = ['tab_switch', 'fullscreen_exit', 'page_blur', 'refresh'];
        if (!validTypes.includes(flagType)) {
            return res.status(400).json({ message: 'Invalid flag type' });
        }

        const quizState = await QuizState.findOneAndUpdate(
            { userId, quizId: actualQuizId },
            {
                $inc: { flagCount: 1 },
                $push: { flagEvents: { type: flagType, timestamp: new Date() } }
            },
            { new: true }
        );

        if (!quizState) {
            return res.status(404).json({ message: 'Quiz state not found' });
        }

        // Get user details for the real-time broadcast
        const user = await User.findById(userId).select('name email');

        // Emit real-time flag event to admin via Socket.IO
        if (io) {
            const roomName = `admin:${actualQuizId.toString()}`;
            const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
            console.log(`📡 BROADCASTING Flag Update: [Room: ${roomName}] [Viewers: ${roomSize}] [User: ${user?.name}] [Flag: ${flagType}]`);
            
            io.to(roomName).emit('flag:update', {
                userId: userId.toString(),
                userName: user?.name || 'Unknown',
                userEmail: user?.email || '',
                quizId: actualQuizId.toString(),
                flagType,
                flagCount: quizState.flagCount,
                flagEvents: quizState.flagEvents,
                timestamp: new Date()
            });
        } else {
            console.warn('⚠️ Cannot broadcast flag: Socket.IO (io) instance NOT EXPORTED correctly');
        }

        res.json({ flagCount: quizState.flagCount });
    } catch (error) {
        res.status(500).json({ message: 'Error reporting flag', error: error.message });
    }
};
