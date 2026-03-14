import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import QuizState from '../models/QuizState.js';
import { getIO } from '../socket.js';

// --- Data Structures for Caching (Designed for future Redis migration) ---

// 1. Quiz Metadata & Questions Cache
/**
 * quizCache = {
 *   [quizId]: {
 *     quiz: Object,
 *     questions: Array,
 *     duration: number
 *   }
 * }
 */
const quizCache = new Map();

// 2. Active Quiz State Cache
/**
 * activeQuizzes = {
 *   [quizId]: {
 *     users: {
 *       [userId]: {
 *         answers: Object,
 *         timeRemaining: number,
 *         flagCount: number,
 *         flagEvents: Array,
 *         startedAt: Date,
 *         lastSavedAt: Date
 *       }
 *     }
 *   }
 * }
 */
const activeQuizzes = new Map();

// --- 3. Backend Request Queue for MongoDB Writes ---
const saveQueue = new Map(); // key: `${userId}:${quizId}`, value: { answers: {}, timeRemaining: number }

const flushQueue = async () => {
    if (saveQueue.size === 0) return;

    const entries = [...saveQueue.entries()];
    saveQueue.clear();

    const bulkOps = entries.map(([key, data]) => {
        const [userId, quizId] = key.split(':');
        const setPayload = {};
        for (const [qId, ans] of Object.entries(data.answers)) {
            setPayload[`answers.${qId}`] = ans;
        }
        return {
            updateOne: {
                filter: { userId, quizId },
                update: { 
                    $set: { 
                        ...setPayload, 
                        timeRemaining: data.timeRemaining,
                        lastSavedAt: new Date() 
                    } 
                },
                upsert: true
            }
        };
    });

    try {
        await QuizState.bulkWrite(bulkOps, { ordered: false });
        console.log(`[Queue] Flushed ${bulkOps.length} saves to MongoDB`);
    } catch (err) {
        console.error('[Queue] Error flushing to DB:', err);
    }
};

setInterval(flushQueue, 3000); // Drain every 3 seconds

// --- Cache Helpers ---

// Resolves and caches quiz metadata and questions to prevent repeated DB reads
const resolveQuiz = async (idOrCode) => {
    if (!idOrCode) return null;
    
    const quizCodeRegexString = idOrCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // First check memory cache
    for (const [quizId, cachedData] of quizCache.entries()) {
        if (cachedData.quiz.quizCode.toLowerCase() === idOrCode.toLowerCase() || quizId.toString() === idOrCode.toString()) {
            return cachedData.quiz;
        }
    }

    let quiz = null;
    if (mongoose.Types.ObjectId.isValid(idOrCode)) {
        quiz = await Quiz.findById(idOrCode).lean();
    } else {
        quiz = await Quiz.findOne({ 
            quizCode: { $regex: new RegExp(`^${quizCodeRegexString}$`, 'i') } 
        }).lean();
    }

    if (quiz) {
        // Cache this quiz heavily
        const questions = await Question.find({ quizId: quiz._id }).lean();
        quizCache.set(quiz._id.toString(), {
            quiz,
            questions,
            duration: quiz.duration
        });

        // Initialize user state container for this quiz if it doesn't exist
        if (!activeQuizzes.has(quiz._id.toString())) {
            activeQuizzes.set(quiz._id.toString(), { users: new Map() });
        }
        
        return quiz;
    }

    return null;
};

// Gets user state from memory or fallback briefly to database if they were mid-session from earlier version.
const getUserState = async (quizIdStr, userIdStr) => {
    if (!activeQuizzes.has(quizIdStr)) {
        activeQuizzes.set(quizIdStr, { users: new Map() });
    }
    const quizUsers = activeQuizzes.get(quizIdStr).users;
    
    let userState = quizUsers.get(userIdStr);
    
    if (!userState) {
        // Fallback for mid-flight restarts. Can be removed later.
        const dbState = await QuizState.findOne({ userId: userIdStr, quizId: quizIdStr }).lean();
        if (dbState) {
            userState = {
                answers: dbState.answers ? Object.fromEntries(Object.entries(dbState.answers)) : {},
                timeRemaining: dbState.timeRemaining,
                flagCount: dbState.flagCount || 0,
                flagEvents: dbState.flagEvents || [],
                startedAt: dbState.startedAt,
                lastSavedAt: dbState.lastSavedAt
            };
            quizUsers.set(userIdStr, userState);
        }
    }
    
    return userState;
};

// --- Controller Functions ---

export const getActiveQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isActive: true }).lean();
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
    }
};

export const getPublishedLeaderboards = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ leaderboardPublished: true }).select('title _id').lean();
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

export const getQuizInfo = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // Check if user already submitted
        const existingSubmission = await Submission.exists({ userId: req.user.id, quizId: quiz._id });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        let savedState = await getUserState(actualQuizIdStr, userIdStr);

        if (savedState) {
            // Calculate remaining time
            const attemptStartedAt = new Date(savedState.startedAt).getTime();
            const attemptElapsedSeconds = Math.floor((Date.now() - attemptStartedAt) / 1000);
            let timeRemaining = Math.max(0, (quiz.duration * 60) - attemptElapsedSeconds);

            // Time expired
            if (timeRemaining <= 0) {
                let score = 0;
                const questionsList = quizCache.get(actualQuizIdStr).questions;
                const answersObj = savedState.answers || {};

                const evaluatedAnswers = Object.keys(answersObj).map(qId => {
                    const question = questionsList.find(q => q._id.toString() === qId);
                    const isCorrect = question && question.correctAnswer === answersObj[qId];
                    if (isCorrect) score += 1;
                    return { questionId: qId, selectedOption: answersObj[qId], isCorrect };
                });

                await Submission.create({
                    userId: req.user.id, quizId: quiz._id,
                    answers: evaluatedAnswers, score,
                    isSuspicious: true, tabSwitches: savedState.flagCount || 0, fullscreenExits: 0
                });

                // Clear from memory
                activeQuizzes.get(actualQuizIdStr).users.delete(userIdStr);
                await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });
                
                return res.status(403).json({ message: 'Your quiz time has expired. It has been automatically submitted.' });
            }

            // User is resuming
            let questions = quizCache.get(actualQuizIdStr).questions.map(({ correctAnswer, ...q }) => q);
            
            return res.json({
                quiz, questions,
                savedState: { answers: savedState.answers, timeRemaining },
                status: 'resuming'
            });
        }

        // Fresh quiz
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

export const startQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);
        
        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // Check if user already submitted
        const existingSubmission = await Submission.exists({ userId: req.user.id, quizId: quiz._id });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Check if already in memory cache 
        if (await getUserState(actualQuizIdStr, userIdStr)) {
            return res.status(400).json({ message: 'Quiz already started. Please resume.' });
        }

        // Check date
        if (quiz.startTime) {
            const nowMs = Date.now();
            const startTimeMs = new Date(quiz.startTime).getTime();
            if (nowMs < startTimeMs) {
                return res.status(403).json({ message: 'This quiz has not started yet.' });
            }
        }

        // Scramble questions from cache (do not alter cache directly)
        let questions = JSON.parse(JSON.stringify(quizCache.get(actualQuizIdStr).questions));

        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        questions = questions.map(q => {
            delete q.correctAnswer;
            for (let i = q.options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
            }
            return q;
        });

        const now = Date.now();
        // Insert directly into IN-MEMORY ONLY
        activeQuizzes.get(actualQuizIdStr).users.set(userIdStr, {
            answers: {},
            startedAt: new Date(now),
            timeRemaining: quiz.duration * 60,
            lastSavedAt: new Date(now),
            flagCount: 0,
            flagEvents: []
        });

        console.log(`🚀 [Quiz] User ${userIdStr} naturally started Quiz: ${actualQuizIdStr}`);
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
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // Update In-Memory Cache (Blazing Fast, NO DB load)
        let userState = await getUserState(actualQuizIdStr, userIdStr);
        if (userState) {
            userState.answers = { ...userState.answers, ...answers }; // Merge partial answers
            userState.timeRemaining = timeRemaining;
            userState.lastSavedAt = new Date();
        } else {
            // Should not happen if they started properly, but fallback
            userState = {
                answers,
                timeRemaining,
                lastSavedAt: new Date(),
                startedAt: new Date(), 
                flagCount: 0,
                flagEvents: []
            };
            activeQuizzes.get(actualQuizIdStr).users.set(userIdStr, userState);
        }

        // Add to MongoDB Write Queue
        if (answers && Object.keys(answers).length > 0) {
            const queueKey = `${userIdStr}:${actualQuizIdStr}`;
            const existing = saveQueue.get(queueKey) || { answers: {}, timeRemaining };
            saveQueue.set(queueKey, {
                answers: { ...existing.answers, ...answers },
                timeRemaining
            });
        }

        res.status(200).json({ success: true, message: 'Quiz state queued for save' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving quiz state', error: error.message });
    }
};

export const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers, isSuspicious, tabSwitches, fullscreenExits } = req.body; 
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        const questions = quizCache.get(actualQuizIdStr).questions;
        
        // Single DB hit ONLY on submission to get past attempts map
        const previousSubmissionsCount = await Submission.countDocuments({ userId: req.user.id, quizId: quiz._id });

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

        // Create Submission (The ONLY MongoDB write)
        const submission = await Submission.create({
            userId: req.user.id,
            quizId: quiz._id,
            answers: evaluatedAnswers,
            score,
            isSuspicious: isSuspicious || false,
            tabSwitches: tabSwitches || 0,
            fullscreenExits: fullscreenExits || 0,
            attemptNumber: previousSubmissionsCount + 1
        });

        // Delete from RAM cache
        if (activeQuizzes.has(actualQuizIdStr)) {
            activeQuizzes.get(actualQuizIdStr).users.delete(userIdStr);
        }
        await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });

        console.log(`✅ [Quiz] User ${userIdStr} submitted Quiz: ${actualQuizIdStr} | Score: ${score}/${questions.length}`);
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

        // Optimized Leaderboard query using MongoDB Aggregation
        const leaderboard = await Submission.aggregate([
            { $match: { quizId: quiz._id } },
            // Sort by score first to ensure $first takes the best score per user
            { $sort: { score: -1, submittedAt: 1 } },
            { $group: {
                _id: "$userId",
                bestScore: { $first: "$score" }
            }},
            // Lookup user details
            { $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }},
            { $unwind: "$user" },
            { $match: { "user.role": "user" } },
            { $project: {
                _id: 1,
                name: "$user.name",
                score: "$bestScore"
            }},
            { $sort: { score: -1 } },
            { $limit: 10 }
        ]);

        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
    }
};

export const getMyResults = async (req, res) => {
    try {
        const submissions = await Submission.find({ userId: req.user.id })
            .populate('quizId', 'title resultsPublished').lean();

        const publishedSubmissions = submissions.filter(s => s.quizId && s.quizId.resultsPublished);

        // Fetch question counts using the cache
        for (let sub of publishedSubmissions) {
            const actualQuizIdStr = sub.quizId._id.toString();
            // Load into cache if not present (to get question counts)
            await resolveQuiz(actualQuizIdStr);
            const cacheHit = quizCache.get(actualQuizIdStr);
            sub.totalQuestions = cacheHit ? cacheHit.questions.length : 0;
        }

        res.json(publishedSubmissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your results', error: error.message });
    }
};

export const reportFlag = async (req, res) => {
    try {
        const { quizId, flagType } = req.body;
        const userIdStr = req.user.id.toString();
        
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        const actualQuizIdStr = quiz._id.toString();

        const validTypes = ['tab_switch', 'fullscreen_exit', 'page_blur', 'refresh'];
        if (!validTypes.includes(flagType)) {
            return res.status(400).json({ message: 'Invalid flag type' });
        }

        let userState = await getUserState(actualQuizIdStr, userIdStr);

        if (!userState) {
            return res.status(404).json({ message: 'Quiz state not found' });
        }

        userState.flagCount = (userState.flagCount || 0) + 1;
        if (!userState.flagEvents) userState.flagEvents = [];
        userState.flagEvents.push({ type: flagType, timestamp: new Date() });

        // Get user details for the real-time broadcast (DB read ONLY for Admin, others hit cache optionally or just run DB once)
        let user = null;
        if (userIdStr !== 'admin-id') {
            user = await User.findById(req.user.id).select('name email').lean();
        } else {
            user = { name: 'System Admin', email: 'dharsan@admin.com' };
        }

        // Emit real-time flag event to admin via Socket.IO
        const io = getIO();
        if (io) {
            const roomName = `admin:${actualQuizIdStr}`;
            const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
            console.log(`📡 BROADCASTING Flag Update: [Room: ${roomName}] [Viewers: ${roomSize}] [User: ${user?.name}] [Flag: ${flagType}]`);
            
            io.to(roomName).emit('flag:update', {
                userId: userIdStr,
                userName: user?.name || 'Unknown',
                userEmail: user?.email || '',
                quizId: actualQuizIdStr,
                flagType,
                flagCount: userState.flagCount,
                flagEvents: userState.flagEvents,
                timestamp: new Date()
            });
        }

        res.json({ flagCount: userState.flagCount });
    } catch (error) {
        res.status(500).json({ message: 'Error reporting flag', error: error.message });
    }
};
