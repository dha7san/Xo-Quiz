import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const QuizPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const fetchQuizAndQuestions = async () => {
            try {
                const res = await axios.post('http://localhost:5000/api/quiz/start', { quizId: id }, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });

                setQuiz(res.data.quiz);
                setQuestions(res.data.questions);

                // Calculate timer
                // Store end time in localStorage to persist across reloads
                const storageKey = `quiz_end_time_${id}`;
                let endTime = localStorage.getItem(storageKey);

                if (!endTime) {
                    endTime = Date.now() + res.data.quiz.duration * 60 * 1000;
                    localStorage.setItem(storageKey, endTime);
                }

                const remaining = Math.max(0, Math.floor((parseInt(endTime) - Date.now()) / 1000));
                setTimeLeft(remaining);

            } catch (error) {
                console.error('Error fetching quiz:', error);
                alert(error.response?.data?.message || 'Error starting quiz');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchQuizAndQuestions();
    }, [id, user.token, navigate]);

    useEffect(() => {
        if (loading || submitting || result) return;

        if (timeLeft <= 0) {
            handleSubmit();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, loading, submitting, result]);

    const handleOptionSelect = (questionId, option) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: option
        }));
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);

        const formattedAnswers = Object.keys(answers).map(qId => ({
            questionId: qId,
            selectedOption: answers[qId]
        }));

        try {
            const res = await axios.post('http://localhost:5000/api/quiz/submit', {
                quizId: id,
                answers: formattedAnswers
            }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            localStorage.removeItem(`quiz_end_time_${id}`);
            setResult(res.data);
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Error submitting quiz');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) return <div className="text-center mt-20 text-xl font-bold">Loading your questions...</div>;

    if (result) {
        return (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md text-center">
                <h2 className="text-3xl font-bold mb-4 text-indigo-600">Quiz Completed!</h2>
                <div className="bg-indigo-50 border border-indigo-200 rounded p-6 mb-6">
                    <p className="text-xl text-gray-800">Your results have been recorded and will be available once the admin publishes them.</p>
                </div>
                <button
                    onClick={() => navigate('/my-results')}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-bold mr-4"
                >
                    My Results
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md hover:bg-gray-300 font-bold"
                >
                    Go Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="sticky top-0 bg-white z-10 p-4 rounded-lg shadow mb-6 flex justify-between items-center border-b-4 border-indigo-500">
                <h2 className="text-xl font-bold text-gray-800">{quiz?.title}</h2>
                <div className={`text-xl font-mono font-bold px-4 py-2 rounded ${timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-800'}`}>
                    Time Left: {formatTime(timeLeft)}
                </div>
            </div>

            <div className="space-y-6">
                {questions.map((q, index) => (
                    <div key={q._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            <span className="text-indigo-600 font-bold mr-2">{index + 1}.</span>
                            {q.question}
                        </h3>
                        <div className="space-y-3">
                            {q.options.map((opt, i) => (
                                <label
                                    key={i}
                                    className={`flex items-center p-3 rounded cursor-pointer border hover:bg-indigo-50 transition border-gray-200 ${answers[q._id] === opt ? 'bg-indigo-50 border-indigo-400 border-2' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name={`question-${q._id}`}
                                        value={opt}
                                        checked={answers[q._id] === opt}
                                        onChange={() => handleOptionSelect(q._id, opt)}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 mr-3"
                                    />
                                    <span className="text-gray-700">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 mb-20 flex justify-end">
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-green-600 text-white px-8 py-3 rounded hover:bg-green-700 font-bold text-lg disabled:opacity-50"
                >
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
            </div>
        </div>
    );
};

export default QuizPage;
