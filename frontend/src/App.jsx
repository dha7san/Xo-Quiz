import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QuizPage from './pages/QuizPage';
import Leaderboard from './pages/Leaderboard';
import MyResults from './pages/MyResults';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      {/* User Routes */}
      <Route
        path="/"
        element={
          <PrivateRoute roles={['user', 'admin']}>
            {user?.role === 'admin' ? <Navigate to="/admin" replace /> : <UserDashboard />}
          </PrivateRoute>
        }
      />
      <Route
        path="/quiz/:id"
        element={
          <PrivateRoute roles={['user']}>
            <QuizPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <PrivateRoute roles={['user', 'admin']}>
            <Leaderboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/my-results"
        element={
          <PrivateRoute roles={['user']}>
            <MyResults />
          </PrivateRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <PrivateRoute roles={['admin']}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 text-gray-800">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-indigo-600">Symposium Quiz App</h1>
              <AuthStatus />
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <AppRoutes />
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
};

const AuthStatus = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">Hello, {user.name}</span>
      <button
        onClick={logout}
        className="text-sm bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded"
      >
        Logout
      </button>
    </div>
  );
};

export default App;
