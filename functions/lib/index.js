"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const joi_1 = __importDefault(require("joi"));
const uuid_1 = require("uuid");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();
const auth = admin.auth();
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: true,
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
// Validation schemas
const timeEntrySchema = joi_1.default.object({
    projectId: joi_1.default.string().optional(),
    description: joi_1.default.string().required(),
    startTime: joi_1.default.date().required(),
    endTime: joi_1.default.date().optional(),
    duration: joi_1.default.number().min(0).required(),
    isBillable: joi_1.default.boolean().default(false),
    tags: joi_1.default.array().items(joi_1.default.string()).default([])
});
const projectSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    color: joi_1.default.string().required(),
    status: joi_1.default.string().valid('active', 'on-hold', 'completed', 'cancelled').default('active'),
    priority: joi_1.default.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    clientId: joi_1.default.string().optional()
});
// Utility functions
const formatTimeFromSeconds = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
// Routes
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Time Entries API
app.get('/api/time-entries', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, projectId, billableOnly } = req.query;
        const userId = req.user.uid;
        let query = db.ref('timeEntries').orderByChild('userId').equalTo(userId);
        const snapshot = await query.once('value');
        let entries = [];
        if (snapshot.exists()) {
            entries = Object.values(snapshot.val());
            // Apply filters
            if (startDate) {
                entries = entries.filter((entry) => new Date(entry.startTime) >= new Date(startDate));
            }
            if (endDate) {
                entries = entries.filter((entry) => new Date(entry.startTime) <= new Date(endDate));
            }
            if (projectId) {
                entries = entries.filter((entry) => entry.projectId === projectId);
            }
            if (billableOnly === 'true') {
                entries = entries.filter((entry) => entry.isBillable);
            }
            // Sort by start time (newest first)
            entries.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        }
        res.json({
            success: true,
            data: entries,
            count: entries.length
        });
    }
    catch (error) {
        console.error('Error fetching time entries:', error);
        res.status(500).json({ error: 'Failed to fetch time entries' });
    }
});
app.post('/api/time-entries', authenticateToken, async (req, res) => {
    try {
        const { error, value } = timeEntrySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const userId = req.user.uid;
        const entryId = (0, uuid_1.v4)();
        const now = new Date();
        // Get project name if projectId provided
        let projectName = null;
        if (value.projectId) {
            const projectSnapshot = await db.ref(`projects/${value.projectId}`).once('value');
            if (projectSnapshot.exists()) {
                projectName = projectSnapshot.val().name;
            }
        }
        const timeEntry = {
            id: entryId,
            userId,
            projectId: value.projectId,
            projectName,
            description: value.description,
            startTime: value.startTime,
            endTime: value.endTime || null,
            duration: value.duration,
            isRunning: !value.endTime,
            isBillable: value.isBillable,
            tags: value.tags,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };
        await db.ref(`timeEntries/${entryId}`).set(timeEntry);
        res.status(201).json({
            success: true,
            data: timeEntry,
            message: 'Time entry created successfully'
        });
    }
    catch (error) {
        console.error('Error creating time entry:', error);
        res.status(500).json({ error: 'Failed to create time entry' });
    }
});
// Projects API
app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const snapshot = await db.ref('projects').once('value');
        const projects = snapshot.exists() ? Object.values(snapshot.val()) : [];
        // Filter out archived projects
        const activeProjects = projects.filter((project) => !project.isArchived);
        res.json({
            success: true,
            data: activeProjects,
            count: activeProjects.length
        });
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
app.post('/api/projects', authenticateToken, async (req, res) => {
    try {
        const { error, value } = projectSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const userId = req.user.uid;
        const projectId = (0, uuid_1.v4)();
        const now = new Date();
        const project = Object.assign(Object.assign({ id: projectId }, value), { isArchived: false, createdBy: userId, createdAt: now.toISOString(), updatedAt: now.toISOString() });
        await db.ref(`projects/${projectId}`).set(project);
        res.status(201).json({
            success: true,
            data: project,
            message: 'Project created successfully'
        });
    }
    catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
// Time Summary API
app.get('/api/time-summary', authenticateToken, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const userId = req.user.uid;
        const now = new Date();
        let startDate, endDate;
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'week':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
                endDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59);
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
        }
        const query = db.ref('timeEntries').orderByChild('userId').equalTo(userId);
        const snapshot = await query.once('value');
        let entries = [];
        if (snapshot.exists()) {
            // Fix for date range filtering: set end date to end of day to include all entries for that day
            const adjustedEndDate = new Date(endDate);
            adjustedEndDate.setHours(23, 59, 59, 999);
            entries = Object.values(snapshot.val()).filter((entry) => {
                const entryDate = new Date(entry.startTime);
                return entryDate >= startDate && entryDate <= adjustedEndDate;
            });
        }
        const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
        const billableDuration = entries
            .filter((entry) => entry.isBillable)
            .reduce((sum, entry) => sum + entry.duration, 0);
        const summary = {
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalDuration,
            billableDuration,
            nonBillableDuration: totalDuration - billableDuration,
            totalEntries: entries.length,
            billableEntries: entries.filter((entry) => entry.isBillable).length,
            formattedTotal: formatTimeFromSeconds(totalDuration),
            formattedBillable: formatTimeFromSeconds(billableDuration),
            formattedNonBillable: formatTimeFromSeconds(totalDuration - billableDuration)
        };
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('Error fetching time summary:', error);
        res.status(500).json({ error: 'Failed to fetch time summary' });
    }
});
// Calendar API
app.get('/api/calendar', authenticateToken, async (req, res) => {
    try {
        const { year, month, projectId, billableOnly } = req.query;
        const userId = req.user.uid;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth();
        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
        const query = db.ref('timeEntries').orderByChild('userId').equalTo(userId);
        const snapshot = await query.once('value');
        let entries = [];
        if (snapshot.exists()) {
            entries = Object.values(snapshot.val()).filter((entry) => {
                const entryDate = new Date(entry.startTime);
                return entryDate >= startDate && entryDate <= endDate;
            });
            // Apply filters
            if (projectId) {
                entries = entries.filter((entry) => entry.projectId === projectId);
            }
            if (billableOnly === 'true') {
                entries = entries.filter((entry) => entry.isBillable);
            }
        }
        // Group entries by date
        const calendarData = {};
        entries.forEach((entry) => {
            const date = new Date(entry.startTime).toDateString();
            if (!calendarData[date]) {
                calendarData[date] = {
                    date,
                    events: [],
                    totalDuration: 0,
                    billableDuration: 0
                };
            }
            calendarData[date].events.push(entry);
            calendarData[date].totalDuration += entry.duration;
            if (entry.isBillable) {
                calendarData[date].billableDuration += entry.duration;
            }
        });
        res.json({
            success: true,
            data: Object.values(calendarData),
            month: targetMonth,
            year: targetYear
        });
    }
    catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
});
// Delete user API (admin only)
app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.uid;
        // Verify requester is an admin, super_admin, or root
        const requesterRef = db.ref(`users/${requesterId}`);
        const requesterSnapshot = await requesterRef.once('value');
        if (!requesterSnapshot.exists()) {
            return res.status(403).json({ error: 'User not found' });
        }
        const requesterData = requesterSnapshot.val();
        const isAdmin = ['admin', 'super_admin', 'root'].includes(requesterData.role);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        // If requester is not root, verify they're deleting a user from their company
        if (requesterData.role !== 'root') {
            const userToDeleteRef = db.ref(`users/${userId}`);
            const userToDeleteSnapshot = await userToDeleteRef.once('value');
            if (!userToDeleteSnapshot.exists()) {
                return res.status(404).json({ error: 'User to delete not found' });
            }
            const userToDeleteData = userToDeleteSnapshot.val();
            if (userToDeleteData.companyId !== requesterData.companyId) {
                return res.status(403).json({ error: 'Cannot delete users from other companies' });
            }
        }
        // Delete user from Firebase Authentication
        try {
            await auth.deleteUser(userId);
            console.log(`User ${userId} deleted from Firebase Auth`);
        }
        catch (authError) {
            console.warn(`Failed to delete user ${userId} from Firebase Auth:`, authError);
            // Continue with database deletion even if Auth deletion fails
        }
        // Delete user data from Realtime Database
        const userRef = db.ref(`users/${userId}`);
        await userRef.remove();
        // Delete user's time entries
        const timeEntriesRef = db.ref('timeEntries');
        const timeEntriesQuery = timeEntriesRef.orderByChild('userId').equalTo(userId);
        const timeEntriesSnapshot = await timeEntriesQuery.once('value');
        if (timeEntriesSnapshot.exists()) {
            const updates = {};
            Object.keys(timeEntriesSnapshot.val()).forEach(entryId => {
                updates[`timeEntries/${entryId}`] = null;
            });
            await db.ref().update(updates);
        }
        // Delete user from any teams they're a member of
        const teamsRef = db.ref('teams');
        const teamsSnapshot = await teamsRef.once('value');
        if (teamsSnapshot.exists()) {
            const updates = {};
            Object.entries(teamsSnapshot.val()).forEach(([teamId, team]) => {
                if (team.members && team.members[userId]) {
                    updates[`teams/${teamId}/members/${userId}`] = null;
                }
            });
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
            }
        }
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});
// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
// Export the deleteUser function as a callable function
exports.deleteUser = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const userId = data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a userId.');
    }
    // Verify requester is an admin, super_admin, or root
    const requesterId = context.auth.uid;
    const requesterRef = db.ref(`users/${requesterId}`);
    const requesterSnapshot = await requesterRef.once('value');
    if (!requesterSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    const requesterData = requesterSnapshot.val();
    const isAdmin = ['admin', 'super_admin', 'root'].includes(requesterData.role);
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions.');
    }
    // If requester is not root, verify they're deleting a user from their company
    if (requesterData.role !== 'root') {
        const userToDeleteRef = db.ref(`users/${userId}`);
        const userToDeleteSnapshot = await userToDeleteRef.once('value');
        if (!userToDeleteSnapshot.exists()) {
            throw new functions.https.HttpsError('not-found', 'User to delete not found.');
        }
        const userToDeleteData = userToDeleteSnapshot.val();
        if (userToDeleteData.companyId !== requesterData.companyId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot delete users from other companies.');
        }
    }
    try {
        // Delete user from Firebase Authentication
        try {
            await auth.deleteUser(userId);
            console.log(`User ${userId} deleted from Firebase Auth`);
        }
        catch (authError) {
            console.warn(`Failed to delete user ${userId} from Firebase Auth:`, authError);
            // Continue with database deletion even if Auth deletion fails
        }
        // Delete user data from Realtime Database
        const userRef = db.ref(`users/${userId}`);
        await userRef.remove();
        // Delete user's time entries
        const timeEntriesRef = db.ref('timeEntries');
        const timeEntriesQuery = timeEntriesRef.orderByChild('userId').equalTo(userId);
        const timeEntriesSnapshot = await timeEntriesQuery.once('value');
        if (timeEntriesSnapshot.exists()) {
            const updates = {};
            Object.keys(timeEntriesSnapshot.val()).forEach(entryId => {
                updates[`timeEntries/${entryId}`] = null;
            });
            await db.ref().update(updates);
        }
        // Delete user from any teams they're a member of
        const teamsRef = db.ref('teams');
        const teamsSnapshot = await teamsRef.once('value');
        if (teamsSnapshot.exists()) {
            const updates = {};
            Object.entries(teamsSnapshot.val()).forEach(([teamId, team]) => {
                if (team.members && team.members[userId]) {
                    updates[`teams/${teamId}/members/${userId}`] = null;
                }
            });
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
            }
        }
        return { success: true, message: 'User deleted successfully' };
    }
    catch (error) {
        console.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete user.');
    }
});
//# sourceMappingURL=index.js.map