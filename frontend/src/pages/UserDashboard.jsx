import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserDashboard = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/quiz', {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setQuizzes(res.data);
            } catch (error) {
                console.error('Error fetching quizzes:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchQuizzes();
    }, [user.token]);

    const handleJoinQuiz = (quizId) => {
        navigate(`/quiz/${quizId}`);
    };

    if (loading) return <div className="text-center mt-10">Loading quizzes...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Available Quizzes</h2>
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/my-results')}
                        className="bg-green-100 text-green-700 font-bold px-4 py-2 rounded-md hover:bg-green-200"
                    >
                        My Results
                    </button>
                    <button
                        onClick={() => navigate('/leaderboard')}
                        className="bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-md hover:bg-indigo-200"
                    >
                        View Leaderboard
                    </button>
                </div>
            </div>

            {quizzes.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
                    No active quizzes available right now. Check back later!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map(quiz => (
                        <div key={quiz._id} className="bg-white rounded-lg shadow-md p-6 border-t-4 border-indigo-500">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{quiz.title}</h3>
                            <p className="text-gray-600 mb-4">Duration: {quiz.duration} minutes</p>
                            <button
                                onClick={() => handleJoinQuiz(quiz._id)}
                                className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                            >
                                Join Quiz
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
