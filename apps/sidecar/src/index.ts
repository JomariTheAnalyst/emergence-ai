import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { fileRoutes } from './routes/files';
import { searchRoutes } from './routes/search';
import { terminalRoutes } from './routes/terminal';
import { healthRoutes } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();
const port = process.env.PORT || 4001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// File upload middleware
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Routes
app.use('/api/health', healthRoutes);

// File upload configuration for file routes
const fileRouter = express.Router();
fileRouter.use(upload.single('file'));
fileRouter.use('/', fileRoutes);
app.use('/api/files', fileRouter);

app.use('/api/search', searchRoutes);
app.use('/api/terminal', terminalRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Sidecar service running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Workspace: ${process.env.WORKSPACE_DIR}`);
});

export default app;