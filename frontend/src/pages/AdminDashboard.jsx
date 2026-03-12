import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertCircle, User, Terminal, Bell, ShieldAlert, 
    Video, Layout, RefreshCcw, ExternalLink, PlayCircle 
} from 'lucide-react';

// ── Neumorphic styles ──
const neu = {
    card: {
        background: 'var(--neu-bg)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '8px 8px 20px var(--neu-dark), -8px -8px 20px var(--neu-light)'
    },
    inset: {
        background: 'var(--neu-bg)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'inset 4px 4px 10px var(--neu-dark), inset -4px -4px 10px var(--neu-light)'
    }
};

const NeuInput = ({ label, ...props }) => (
    <div>
        {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7a8090', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>}
        <input
            {...props}
            className="neu-input"
            style={{ ...(props.style || {}) }}
        />
    </div>
);

const NeuButton = ({ children, onClick, type = 'button', variant = 'default', small, disabled, style: sx }) => {
    const [pressed, setPressed] = useState(false);
    const gradients = {
        primary: 'linear-gradient(135deg,#6c63ff,#a29bfe)',
        success: 'linear-gradient(135deg,#30d158,#00b894)',
        danger:  'linear-gradient(135deg,#ff3b30,#ff6b6b)',
        warning: 'linear-gradient(135deg,#ff9f0a,#ffd32a)',
    };
    const textColors = { primary: 'white', success: 'white', danger: 'white', warning: '#3d2c00', default: '#555' };
    const isDefault = variant === 'default';
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
            style={{
                padding: small ? '8px 14px' : '10px 20px',
                borderRadius: 'var(--r-md)', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: small ? 12 : 13, fontFamily: 'inherit',
                background: isDefault ? 'var(--neu-bg)' : gradients[variant],
                color: textColors[variant] || '#555',
                opacity: disabled ? 0.5 : 1,
                boxShadow: isDefault
                    ? (pressed ? 'inset 3px 3px 8px var(--neu-dark), inset -3px -3px 8px var(--neu-light)' : '5px 5px 12px var(--neu-dark), -5px -5px 12px var(--neu-light)')
                    : '0 4px 14px rgba(108,99,255,0.25)',
                transition: 'all 140ms ease', transform: pressed ? 'scale(0.97)' : 'scale(1)',
                whiteSpace: 'nowrap', ...sx
            }}
        >{children}</button>
    );
};

// Converts a Date to the format required by datetime-local inputs (local time, not UTC)
const toLocalInputValue = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 16);
};

const TABS = [
    { id: 'quizzes', label: '📋 Quizzes' },
    { id: 'questions', label: '❓ Questions' },
    { id: 'results', label: '📊 Results' },
    { id: 'users', label: '👥 Users' },
];

const AdminDashboard = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('quizzes');
    const [quizzes, setQuizzes] = useState([]);
    const [results, setResults] = useState([]);
    const [users, setUsers] = useState([]);
    const [attendees, setAttendees] = useState(null);
    const [selectedQuizForAttendees, setSelectedQuizForAttendees] = useState(null);
    const [registrationOpen, setRegistrationOpen] = useState(true);
    const [flagAlerts, setFlagAlerts] = useState([]);
    const socketRef = useRef(null);

    const [title, setTitle] = useState('');
    const [quizCode, setQuizCode] = useState('');
    const [duration, setDuration] = useState(30);
    const [startTime, setStartTime] = useState(toLocalInputValue(new Date()));

    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [questionImage, setQuestionImage] = useState('');
    const [imagePreview, setImagePreview] = useState('');

    const [openDropdownId, setOpenDropdownId] = useState(null);
    const dropdownRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchQuizzes();
        fetchAppSettings();
        if (activeTab === 'results') fetchResults();
        if (activeTab === 'users') fetchUsers();
    }, [activeTab]);

    useEffect(() => {
        const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdownId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } }, []);

    const fetchQuizzes = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/all-quizzes`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res) { setQuizzes(res.data); if (res.data.length > 0 && !selectedQuizId) setSelectedQuizId(res.data[0]._id); }
    };
    const fetchResults = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/results`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res) setResults(res.data);
    };
    const fetchUsers = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res) setUsers(res.data);
    };
    const fetchAppSettings = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/settings`).catch(console.error);
        if (res) setRegistrationOpen(res.data.registrationOpen);
    };

    const handleToggleRegistration = async () => {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-registration`, {}, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message || 'Error'));
        if (res) setRegistrationOpen(res.data.registrationOpen);
    };

    const fetchLiveAttendees = async (quizId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/live-attendees/${quizId}`, { headers: { Authorization: `Bearer ${user.token}` } });
            setAttendees(res.data); setSelectedQuizForAttendees(quizId); setFlagAlerts([]);
            if (socketRef.current) socketRef.current.disconnect();
            const socket = io(import.meta.env.VITE_API_URL, {
                reconnection: true,
                reconnectionAttempts: 5
            });
            socketRef.current = socket;
            
            socket.on('connect', () => {
                console.log('Admin Socket Connected. Joining room:', quizId);
                socket.emit('admin:join', quizId);
            });
            
            socket.on('connect_error', (err) => console.error('Socket Connection Error:', err));
            socket.on('flag:update', (data) => {
                const alertData = { ...data, id: Date.now() };
                setFlagAlerts(prev => [alertData, ...prev].slice(0, 10)); // Keep last 10
                
                // Visual feedback in attendees list
                setAttendees(prev => {
                    if (!prev) return prev;
                    const upd = prev.attendees.map(a => 
                        a._id?.toString() === data.userId 
                            ? { ...a, flagCount: data.flagCount, isSuspicious: true, lastFlagType: data.flagType } 
                            : a
                    );
                    return { ...prev, attendees: upd };
                });
            });
        } catch (e) { console.error(e); }
    };

    const handleToggleResults = async (quizId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-results`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleToggleLeaderboard = async (quizId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-leaderboard`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleStopQuiz = async (quizId) => {
        if (!window.confirm('Stop this quiz? Users won\'t be able to take it anymore.')) return;
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/stop-quiz`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleDeleteQuiz = async (quizId) => {
        if (!window.confirm('DELETE this quiz? All questions and submissions will be removed. This cannot be undone!')) return;
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/delete-quiz/${quizId}`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleBlockUser = async (userId) => {
        if (!window.confirm('Block this user?')) return;
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/block-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        fetchUsers();
    };
    const handleUnblockUser = async (userId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/unblock-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        fetchUsers();
    };
    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        // Convert the datetime-local value (local time) → UTC ISO string before sending
        const startTimeUTC = new Date(startTime).toISOString();
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/create-quiz`, { title, quizCode, duration, startTime: startTimeUTC }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => { alert(e.response?.data?.message || 'Error'); return null; }).then(res => { if (res) { setTitle(''); setQuizCode(''); setDuration(30); setStartTime(toLocalInputValue(new Date())); fetchQuizzes(); } });
    };
    const handleAddQuestion = async (e) => {
        e.preventDefault();
        if (!options.includes(correctAnswer)) return alert('Correct answer must exactly match one of the options.');
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/add-question`, { quizId: selectedQuizId, question, options, correctAnswer, image: questionImage }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => { alert(e.response?.data?.message || 'Error'); return null; }).then(res => { if (res) { setQuestion(''); setOptions(['', '', '', '']); setCorrectAnswer(''); setQuestionImage(''); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; } });
    };
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) { setQuestionImage(''); setImagePreview(''); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); e.target.value = ''; return; }
        // Compress image using canvas to save MongoDB Atlas storage
        const img = new Image();
        const reader = new FileReader();
        reader.onloadend = () => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800; // max width or height in pixels
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                // Fill with white background to handle transparent PNGs
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                
                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                setQuestionImage(compressed);
                setImagePreview(compressed);
            };
            img.onerror = () => {
                alert('Failed to process image. Please try another one.');
                setQuestionImage('');
                setImagePreview('');
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            img.src = reader.result;
        };
        reader.onerror = () => alert('Failed to read file.');
        reader.readAsDataURL(file);
    };

    const bg = 'var(--neu-bg)';
    const labelStyle = { fontSize: 12, fontWeight: 600, color: '#7a8090', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block' };

    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                    Admin Dashboard
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>SVHEC Quiz Portal · Management Console</p>
            </div>

            {/* Registration Toggle */}
            <div style={{ ...neu.card, padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: registrationOpen ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                    }}>
                        {registrationOpen ? '🟢' : '🔴'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: registrationOpen ? '#1a7a3a' : '#cc000a' }}>
                            Registration {registrationOpen ? 'OPEN' : 'CLOSED'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            {registrationOpen ? 'New users can register' : 'Only existing users can log in'}
                        </div>
                    </div>
                </div>
                <NeuButton variant={registrationOpen ? 'danger' : 'success'} onClick={handleToggleRegistration}>
                    {registrationOpen ? '🔒 Close Registration' : '🔓 Open Registration'}
                </NeuButton>
            </div>

            {/* Tab Navigation */}
            <div style={{ ...neu.card, padding: '8px', marginBottom: 24, display: 'flex', gap: 4 }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)',
                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                        fontFamily: 'inherit', transition: 'all var(--transition-smooth)',
                        background: activeTab === tab.id ? 'linear-gradient(135deg, #6c63ff, #a29bfe)' : 'transparent',
                        color: activeTab === tab.id ? 'white' : '#7a8090',
                        boxShadow: activeTab === tab.id ? '0 4px 16px rgba(108,99,255,0.3)' : 'none'
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── QUIZZES TAB ── */}
            {activeTab === 'quizzes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,380px) 1fr', gap: 24, alignItems: 'start' }}>
                    {/* Create Quiz */}
                    <div style={{ ...neu.card, padding: '28px 24px' }}>
                        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: 'var(--color-text-primary)' }}>
                            ＋ Create New Quiz
                        </h3>
                        <form onSubmit={handleCreateQuiz} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <NeuInput label="Quiz Title" type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. ECE Fundamentals 2026" />
                            <NeuInput label="Quiz Code" type="text" required value={quizCode} onChange={e => setQuizCode(e.target.value.toUpperCase())} placeholder="e.g. ECE2026" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }} />
                            <NeuInput label="Duration (minutes)" type="number" required value={duration} onChange={e => setDuration(Number(e.target.value))} min="1" />
                            <NeuInput label="Start Time" type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} />
                            <NeuButton type="submit" variant="primary" style={{ marginTop: 4 }}>Create Quiz →</NeuButton>
                        </form>
                    </div>

                    {/* Quiz List */}
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--color-text-primary)' }}>All Quizzes</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {quizzes.length === 0 && (
                                <div style={{ ...neu.card, padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                                    No quizzes yet. Create your first quiz →
                                </div>
                            )}
                            {quizzes.map(quiz => (
                                <div key={quiz._id} style={{ ...neu.card, padding: '18px 22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{quiz.title}</span>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
                                                    background: quiz.isActive ? 'rgba(48,209,88,0.12)' : 'rgba(0,0,0,0.06)',
                                                    color: quiz.isActive ? '#1a7a3a' : '#888'
                                                }}>
                                                    {quiz.isActive ? '🟢 Active' : '⚫ Stopped'}
                                                </span>
                                                {quiz.resultsPublished && <span className="badge badge-info" style={{ fontSize: 11 }}>Results ✓</span>}
                                                {quiz.leaderboardPublished && <span className="badge badge-success" style={{ fontSize: 11 }}>Board ✓</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                                                <span>🕐 {quiz.duration} min</span>
                                                <span>🔑 {quiz.quizCode}</span>
                                                {quiz.startTime && <span>📅 {new Date(quiz.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <NeuButton small onClick={() => fetchLiveAttendees(quiz._id)}>👥 Attendees</NeuButton>
                                            <div style={{ position: 'relative' }} ref={openDropdownId === quiz._id ? dropdownRef : null}>
                                                <NeuButton small onClick={() => toggleDropdown(quiz._id)}>⋯ More</NeuButton>
                                                {openDropdownId === quiz._id && (
                                                    <div style={{
                                                        position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 50,
                                                        ...neu.card, padding: '8px', minWidth: 200,
                                                        display: 'flex', flexDirection: 'column', gap: 4
                                                    }}>
                                                        {[
                                                            { icon: quiz.resultsPublished ? '🙈' : '📤', label: quiz.resultsPublished ? 'Hide Results' : 'Publish Results', action: () => handleToggleResults(quiz._id) },
                                                            { icon: quiz.leaderboardPublished ? '🙈' : '🏆', label: quiz.leaderboardPublished ? 'Hide Leaderboard' : 'Publish Leaderboard', action: () => handleToggleLeaderboard(quiz._id) },
                                                            { icon: '⏹', label: 'Stop Quiz', action: () => handleStopQuiz(quiz._id), color: '#cc000a' },
                                                            { icon: '🗑', label: 'Delete Quiz', action: () => handleDeleteQuiz(quiz._id), color: '#cc000a' },
                                                        ].map(item => (
                                                            <button key={item.label} onClick={item.action} style={{
                                                                padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
                                                                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                                                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                                                                color: item.color || 'var(--color-text-primary)',
                                                                transition: 'background var(--transition-fast)'
                                                            }}
                                                            onMouseEnter={e => e.target.style.background = 'rgba(0,0,0,0.04)'}
                                                            onMouseLeave={e => e.target.style.background = 'transparent'}>
                                                                {item.icon} {item.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Live Attendees Panel */}
                        {attendees && selectedQuizForAttendees && (
                            <div style={{ ...neu.card, padding: '24px', marginTop: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                                            👥 Live Attendees — {quizzes.find(q => q._id === selectedQuizForAttendees)?.title || ''}
                                        </h3>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                                            {attendees.activeCount > 0 && <span style={{ color: '#1a7a3a', fontWeight: 600 }}>🟢 {attendees.activeCount} active</span>}
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Total: {attendees.attendeeCount} / {attendees.totalUsers}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <NeuButton small onClick={() => fetchLiveAttendees(selectedQuizForAttendees)}>🔄</NeuButton>
                                        <NeuButton small onClick={() => { setAttendees(null); setSelectedQuizForAttendees(null); setFlagAlerts([]); if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } }}>✕</NeuButton>
                                    </div>
                                </div>

                                {/* Live Monitor Section */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 10px #ff3b30', animation: 'pulse 1.5s infinite' }} />
                                        <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111' }}>
                                            Live Activity Feed
                                        </h4>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: flagAlerts.length > 0 ? 'auto' : 80 }}>
                                        <AnimatePresence mode="popLayout">
                                            {flagAlerts.length === 0 ? (
                                                <motion.div 
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                    style={{ padding: '32px 24px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 20, border: '2px dashed rgba(0,0,0,0.08)', color: '#999', fontSize: 13 }}
                                                >
                                                    <div style={{ display: 'inline-flex', padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', marginBottom: 12 }}>
                                                        <Terminal size={24} style={{ opacity: 0.4 }} />
                                                    </div>
                                                    <p style={{ fontWeight: 600, letterSpacing: '0.01em' }}>System Active. Listening for real-time events...</p>
                                                    <p style={{ fontSize: 11, marginTop: 4 }}>Updates will appear here as soon as they are detected.</p>
                                                </motion.div>
                                            ) : (
                                                flagAlerts.map((alert, idx) => {
                                                    const isLatest = idx === 0;
                                                    const isCritical = alert.flagCount >= 3;
                                                    
                                                    return (
                                                        <motion.div
                                                            key={alert.id}
                                                            initial={{ x: -30, opacity: 0, scale: 0.9 }}
                                                            animate={{ 
                                                                x: 0, opacity: 1, scale: isLatest ? 1.02 : 1,
                                                                boxShadow: isLatest ? `0 0 20px ${isCritical ? 'rgba(255, 59, 48, 0.15)' : 'rgba(108, 99, 255, 0.1)'}` : '0 4px 12px rgba(0,0,0,0.03)'
                                                            }}
                                                            exit={{ x: 30, opacity: 0 }}
                                                            layout
                                                            style={{
                                                                padding: isLatest ? '18px 20px' : '14px 18px', 
                                                                borderRadius: 20,
                                                                background: isCritical ? 'rgba(255, 59, 48, 0.05)' : isLatest ? 'white' : 'rgba(255,255,255,0.6)',
                                                                border: `1px solid ${isCritical ? 'rgba(255, 59, 48, 0.3)' : isLatest ? 'rgba(108, 99, 255, 0.2)' : 'rgba(0, 0, 0, 0.04)'}`,
                                                                display: 'flex', alignItems: 'center', gap: 16,
                                                                position: 'relative', overflow: 'hidden'
                                                            }}
                                                        >
                                                            {/* Brand indicator for latest */}
                                                            {isLatest && (
                                                                <div style={{ 
                                                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, 
                                                                    background: isCritical ? '#ff3b30' : 'var(--brand-accent)' 
                                                                }} />
                                                            )}
                                                            
                                                            <div style={{ 
                                                                width: isLatest ? 48 : 40, height: isLatest ? 48 : 40, borderRadius: '50%', 
                                                                background: isCritical ? '#ff3b30' : isLatest ? 'var(--brand-accent)' : '#ff9f0a',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                                                boxShadow: isLatest ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                                                            }}>
                                                                <ShieldAlert size={isLatest ? 24 : 20} strokeWidth={2.5} />
                                                            </div>
                                                            
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                                    <span style={{ fontWeight: 800, fontSize: isLatest ? 15 : 14, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {alert.userName}
                                                                    </span>
                                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLatest ? '#30d158' : '#ccc' }} />
                                                                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isCritical ? '#ff3b30' : '#444' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: 11 }}>
                                                                        {alert.flagType === 'tab_switch' ? <><Layout size={13} /> TAB BREACH</> :
                                                                         alert.flagType === 'fullscreen_exit' ? <><ExternalLink size={13} /> FULLSCREEN EXIT</> :
                                                                         alert.flagType === 'page_blur' ? <><AlertCircle size={13} /> FOCUS LOST</> :
                                                                         alert.flagType === 'refresh' ? <><RefreshCcw size={13} /> RELOAD ATTEMPT</> :
                                                                         <><ShieldAlert size={13} /> SECURITY ALERT</>}
                                                                    </div>
                                                                    <span style={{ opacity: 0.3 }}>|</span>
                                                                    <span style={{ fontWeight: 900, background: isCritical ? '#ff3b30' : 'rgba(0,0,0,0.06)', color: isCritical ? 'white' : '#555', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>
                                                                        FLAG #{alert.flagCount}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            {isCritical && (
                                                                <div style={{ 
                                                                    fontSize: 10, fontWeight: 900, color: 'white', background: '#ff3b30', 
                                                                    padding: '4px 10px', borderRadius: 10, textTransform: 'uppercase', 
                                                                    letterSpacing: '0.05em', boxShadow: '0 4px 10px rgba(255,59,48,0.3)'
                                                                }}>
                                                                    TERMINATED
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    );
                                                })
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Attendees Table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
                                                {['#', 'Name', 'Email', 'Status', 'Flags', 'Score', 'Time'].map(h => (
                                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendees.attendees.map((a, i) => (
                                                <tr key={a._id || i} style={{
                                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                                    background: a.flagCount >= 3 ? 'rgba(255,59,48,0.04)' : a.flagCount > 0 ? 'rgba(255,159,10,0.03)' : 'transparent',
                                                    animation: a.isSuspicious ? 'shake 0.5s ease-in-out' : 'none',
                                                    transition: 'all 0.3s ease'
                                                }}>
                                                    <td style={{ padding: '12px 12px', color: '#aaa', fontWeight: 600 }}>{i + 1}</td>
                                                    <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{a.name || '—'}</td>
                                                    <td style={{ padding: '12px 12px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{a.email || '—'}</td>
                                                    <td style={{ padding: '12px 12px' }}>
                                                        {a.status === 'in_progress'
                                                            ? <span style={{ background: 'rgba(48,209,88,0.12)', color: '#1a7a3a', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>🟢 Active</span>
                                                            : a.isBlocked
                                                            ? <span style={{ background: 'rgba(255,69,58,0.1)', color: '#cc000a', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>Blocked</span>
                                                            : <span style={{ background: 'rgba(108,99,255,0.1)', color: '#6c63ff', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>✅ Done</span>
                                                        }
                                                    </td>
                                                    <td style={{ padding: '12px 12px' }}>
                                                        {a.flagCount > 0
                                                            ? <span style={{ fontWeight: 800, fontSize: 13, color: a.flagCount >= 3 ? '#cc000a' : a.flagCount >= 2 ? '#9e5700' : '#8a7000' }}>
                                                                🚩 {a.flagCount}
                                                              </span>
                                                            : <span style={{ color: '#ccc' }}>0</span>}
                                                    </td>
                                                    <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--brand-accent)' }}>{a.score !== null ? a.score : '—'}</td>
                                                    <td style={{ padding: '12px 12px', color: 'var(--color-text-secondary)', fontSize: 11 }}>
                                                        {a.submittedAt ? new Date(a.submittedAt).toLocaleTimeString() : a.startedAt ? new Date(a.startedAt).toLocaleTimeString() : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {attendees.attendees.length === 0 && (
                                                <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No attendees yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── QUESTIONS TAB ── */}
            {activeTab === 'questions' && (
                <div style={{ ...neu.card, padding: '32px', maxWidth: 640 }}>
                    <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 24 }}>Add Question to Quiz</h3>
                    {quizzes.length === 0 ? (
                        <p style={{ color: 'var(--color-danger)' }}>Please create a quiz first.</p>
                    ) : (
                        <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div>
                                <label style={labelStyle}>Select Quiz</label>
                                <select
                                    value={selectedQuizId}
                                    onChange={e => setSelectedQuizId(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px',
                                        background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-md)',
                                        boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.85)',
                                        fontSize: 14, fontFamily: 'inherit', color: 'var(--color-text-primary)', outline: 'none'
                                    }}
                                >
                                    {quizzes.map(q => <option key={q._id} value={q._id}>{q.title}</option>)}
                                </select>
                            </div>
                            <NeuInput label="Question Text" type="text" required value={question} onChange={e => setQuestion(e.target.value)} placeholder="Enter the question" />
                            <div>
                                <label style={labelStyle}>Question Image (optional)</label>
                                <input
                                    ref={fileInputRef}
                                    type="file" accept="image/*" onChange={handleImageChange}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-md)',
                                        boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.85)',
                                        fontSize: 13, fontFamily: 'inherit', color: 'var(--color-text-primary)', cursor: 'pointer'
                                    }}
                                />
                                {imagePreview && (
                                    <div style={{ marginTop: 12, position: 'relative', display: 'inline-block' }}>
                                        <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '2px solid rgba(108,99,255,0.2)' }} />
                                        <button type="button" onClick={() => { setQuestionImage(''); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{
                                            position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%',
                                            background: '#ff3b30', color: 'white', border: 'none', cursor: 'pointer',
                                            fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 2px 8px rgba(255,59,48,0.4)'
                                        }}>×</button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={labelStyle}>Options</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {options.map((opt, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--neu-bg)', boxShadow: '3px 3px 6px rgba(163,177,198,0.6), -3px -3px 6px rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#8090a0', flexShrink: 0 }}>
                                                {['A','B','C','D'][i]}
                                            </span>
                                            <input
                                                type="text" required value={opt}
                                                onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                                                placeholder={`Option ${['A','B','C','D'][i]}`}
                                                style={{ flex: 1, padding: '10px 14px', background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-sm)', boxShadow: 'inset 3px 3px 8px rgba(163,177,198,0.5), inset -3px -3px 8px rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Correct Answer (must match one option exactly)</label>
                                <select
                                    value={correctAnswer}
                                    onChange={e => setCorrectAnswer(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '12px 16px', background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-md)', boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'inherit', color: 'var(--color-text-primary)', outline: 'none' }}
                                >
                                    <option value="">-- Select correct answer --</option>
                                    {options.filter(o => o.trim()).map((o, i) => <option key={i} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <NeuButton type="submit" variant="success" style={{ marginTop: 4 }}>✓ Add Question</NeuButton>
                        </form>
                    )}
                </div>
            )}

            {/* ── RESULTS TAB ── */}
            {activeTab === 'results' && (
                <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>All Submissions</h3>
                    <div style={{ ...neu.card, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                                    {['Name', 'Quiz', 'Score', 'Suspicious', 'Submitted'].map(h => (
                                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={r._id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>{r.userId?.name || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)' }}>{r.quizId?.title || '—'}</td>
                                        <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--brand-accent)', fontSize: 16 }}>{r.score}</td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {r.isSuspicious
                                                ? <span style={{ color: '#cc000a', background: 'rgba(255,69,58,0.1)', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>🚩 Flagged</span>
                                                : <span style={{ color: '#1a7a3a', fontSize: 12 }}>✓ Clean</span>}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                                            {new Date(r.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                        </td>
                                    </tr>
                                ))}
                                {results.length === 0 && <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No submissions yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === 'users' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 700, fontSize: 16 }}>All Users</h3>
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{users.length} users registered</span>
                    </div>
                    <div style={{ ...neu.card, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                                    {['#', 'Name', 'Email', 'Role', 'Status', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <tr key={u._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: u.isBlocked ? 'rgba(255,69,58,0.02)' : 'transparent' }}>
                                        <td style={{ padding: '14px 20px', color: '#bbb', fontWeight: 600 }}>{i + 1}</td>
                                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-accent), #a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                                                    {u.name?.charAt(0).toUpperCase()}
                                                </div>
                                                {u.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{u.email}</td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 100, background: u.role === 'admin' ? 'rgba(108,99,255,0.1)' : 'rgba(0,0,0,0.06)', color: u.role === 'admin' ? 'var(--brand-accent)' : '#888' }}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {u.isBlocked
                                                ? <span style={{ color: '#cc000a', fontWeight: 700, fontSize: 12 }}>🚫 Blocked</span>
                                                : <span style={{ color: '#1a7a3a', fontWeight: 600, fontSize: 12 }}>✓ Active</span>}
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {u.role !== 'admin' && (
                                                u.isBlocked
                                                    ? <NeuButton small variant="success" onClick={() => handleUnblockUser(u._id)}>Unblock</NeuButton>
                                                    : <NeuButton small variant="danger" onClick={() => handleBlockUser(u._id)}>Block</NeuButton>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && <tr><td colSpan="6" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No users registered yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    function toggleDropdown(quizId) {
        setOpenDropdownId(openDropdownId === quizId ? null : quizId);
    }
};

export default AdminDashboard;
