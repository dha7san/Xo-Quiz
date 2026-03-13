import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            if (!token) {
                console.warn(`⚠️ [Auth] Malformed Header - Missing actual token (User-Agent: ${req.headers['user-agent']})`);
                return res.status(401).json({ message: 'Not authorized, token missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;

            // Check if user is blocked (skip for admin hardcoded id)
            if (decoded.id !== 'admin-id') {
                const dbUser = await User.findById(decoded.id).select('isBlocked');
                if (dbUser && dbUser.isBlocked) {
                    return res.status(403).json({ message: 'Your account has been blocked by the admin.', blocked: true });
                }
            }

            return next();
        } catch (error) {
            console.error(`❌ [Auth Error] Token Verification Failed: ${error.message} (IP: ${req.ip})`);
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired, please login again' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            }
            return res.status(500).json({ message: 'Authentication verification failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};
