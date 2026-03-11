import express from 'express';
import { createQuiz, addQuestion, getResults, getUsers, publishResults } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create-quiz', protect, admin, createQuiz);
router.post('/add-question', protect, admin, addQuestion);
router.get('/results', protect, admin, getResults);
router.get('/users', protect, admin, getUsers);
router.post('/publish-results', protect, admin, publishResults);

export default router;
