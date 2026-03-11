import express from 'express';
import { getActiveQuizzes, startQuiz, submitQuiz, getLeaderboard, getMyResults } from '../controllers/quizController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getActiveQuizzes);
router.post('/start', protect, startQuiz);
router.post('/submit', protect, submitQuiz);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/my-results', protect, getMyResults);

export default router;
