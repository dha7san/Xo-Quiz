import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('quizzes');
    const [quizzes, setQuizzes] = useState([]);
    const [results, setResults] = useState([]);

    // Create Quiz Form
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(30);
    const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));

    // Add Question Form
    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState('');

    useEffect(() => {
        fetchQuizzes();
        if (activeTab === 'results') {
            fetchResults();
        }
    }, [activeTab]);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/quiz', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setQuizzes(res.data);
            if (res.data.length > 0 && !selectedQuizId) {
                setSelectedQuizId(res.data[0]._id);
            }
        } catch (error) {
            console.error('Error fetching quizzes:', error);
        }
    };

    const fetchResults = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/results', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setResults(res.data);
        } catch (error) {
            console.error('Error fetching results:', error);
        }
    };

    const handlePublishResults = async (quizId) => {
        try {
            const res = await axios.post('http://localhost:5000/api/admin/publish-results',
                { quizId },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            alert('Results published successfully!');
            fetchQuizzes();
            if (activeTab === 'results') {
                fetchResults();
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error publishing results');
        }
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/admin/create-quiz',
                { title, duration, startTime },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            alert('Quiz created successfully!');
            setTitle('');
            setDuration(30);
            fetchQuizzes();
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating quiz');
        }
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleAddQuestion = async (e) => {
        e.preventDefault();
        if (!options.includes(correctAnswer)) {
            return alert('Correct answer must exactly match one of the options.');
        }

        try {
            await axios.post('http://localhost:5000/api/admin/add-question',
                { quizId: selectedQuizId, question, options, correctAnswer },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            alert('Question added successfully!');
            setQuestion('');
            setOptions(['', '', '', '']);
            setCorrectAnswer('');
        } catch (error) {
            alert(error.response?.data?.message || 'Error adding question');
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Admin Dashboard</h2>

            <div className="flex border-b mb-6">
                <button
                    className={`py-2 px-6 font-medium text-sm focus:outline-none ${activeTab === 'quizzes' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('quizzes')}
                >
                    Manage Quizzes
                </button>
                <button
                    className={`py-2 px-6 font-medium text-sm focus:outline-none ${activeTab === 'questions' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('questions')}
                >
                    Add Questions
                </button>
                <button
                    className={`py-2 px-6 font-medium text-sm focus:outline-none ${activeTab === 'results' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('results')}
                >
                    View Results
                </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                {/* Create Quiz Tab */}
                {activeTab === 'quizzes' && (
                    <div>
                        <h3 className="text-xl font-bold mb-4">Create New Quiz</h3>
                        <form onSubmit={handleCreateQuiz} className="space-y-4 max-w-xl">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quiz Title</label>
                                <input
                                    type="text" required value={title} onChange={e => setTitle(e.target.value)}
                                    className="mt-1 block w-full border rounded-md p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                                <input
                                    type="number" required value={duration} onChange={e => setDuration(Number(e.target.value))}
                                    className="mt-1 block w-full border rounded-md p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                                <input
                                    type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)}
                                    className="mt-1 block w-full border rounded-md p-2"
                                />
                            </div>
                            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                                Create Quiz
                            </button>
                        </form>

                        <h3 className="text-xl font-bold mt-10 mb-4">Active Quizzes</h3>
                        <ul className="divide-y divide-gray-200 border rounded-md">
                            {quizzes.map(quiz => (
                                <li key={quiz._id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <span className="font-bold">{quiz.title}</span> <span className="text-sm text-gray-500">({quiz.duration} min)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {!quiz.resultsPublished ? (
                                            <button
                                                onClick={() => handlePublishResults(quiz._id)}
                                                className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded hover:bg-yellow-200"
                                            >
                                                Publish Results
                                            </button>
                                        ) : (
                                            <span className="text-xs text-green-600 font-bold">Results Published</span>
                                        )}
                                        <span className={`px-2 py-1 text-xs rounded-full ${quiz.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {quiz.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                            {quizzes.length === 0 && <li className="p-4 text-gray-500">No quizzes available.</li>}
                        </ul>
                    </div>
                )}

                {/* Add Question Tab */}
                {activeTab === 'questions' && (
                    <div>
                        <h3 className="text-xl font-bold mb-4">Add Question to Quiz</h3>
                        {quizzes.length === 0 ? (
                            <p className="text-red-500">Please create a quiz first.</p>
                        ) : (
                            <form onSubmit={handleAddQuestion} className="space-y-4 max-w-xl">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Select Quiz</label>
                                    <select
                                        required value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}
                                        className="mt-1 block w-full border rounded-md p-2"
                                    >
                                        {quizzes.map(q => <option key={q._id} value={q._id}>{q.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Question Text</label>
                                    <textarea
                                        required value={question} onChange={e => setQuestion(e.target.value)}
                                        className="mt-1 block w-full border rounded-md p-2 h-24"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Options (Must be exactly 4)</label>
                                    {options.map((opt, idx) => (
                                        <input
                                            key={idx} required type="text" placeholder={`Option ${idx + 1}`}
                                            value={opt} onChange={e => handleOptionChange(idx, e.target.value)}
                                            className="block w-full border rounded-md p-2"
                                        />
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                                    <input
                                        type="text" required placeholder="Must match one of the options above"
                                        value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)}
                                        className="mt-1 block w-full border rounded-md p-2"
                                    />
                                </div>

                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                                    Add Question
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* Results Tab */}
                {activeTab === 'results' && (
                    <div>
                        <h3 className="text-xl font-bold mb-4">Quiz Results (All Users)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quiz</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {results.map(r => (
                                        <tr key={r._id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.userId?.name || 'Unknown'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.userId?.email || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.quizId?.title || 'Deleted Quiz'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{r.score}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(r.submittedAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {results.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No results found yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
