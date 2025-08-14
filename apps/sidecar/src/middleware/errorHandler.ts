import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', error);

  // Don't log and respond if response was already sent
  if (res.headersSent) {
    return next(error);
  }

  // Default error response
  const errorResponse = {
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = error.stack;
  }

  res.status(500).json(errorResponse);
}