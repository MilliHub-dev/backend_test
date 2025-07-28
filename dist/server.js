"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./database");
const submissions_1 = __importDefault(require("./routes/submissions"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-frontend-domain.com'] // Replace with your actual frontend domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000']
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Routes
app.use('/api/submissions', submissions_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'QA Testing Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            submissions: '/api/submissions'
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});
// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Exiting...');
            process.exit(1);
        }
        // Initialize database tables
        await (0, database_1.initDatabase)();
        // Start the server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    process.exit(0);
});
startServer();
