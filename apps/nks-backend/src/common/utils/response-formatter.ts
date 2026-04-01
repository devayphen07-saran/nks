/**
 * Unified API Response Format Utility
 * Ensures consistent response structure across all endpoints
 */

import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message?: string | null;
  data: T;
  metadata?: {
    count?: number;
    timestamp?: string;
    version?: string;
    totalPages?: number;
    currentPage?: number;
  };
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string | string[]>;
  data?: null;
}

/**
 * Format successful response
 * @param data - Response data
 * @param message - Optional success message
 * @param count - Optional item count for lists
 */
export const formatSuccess = <T>(
  data: T,
  message?: string | null,
  metadata?: {
    count?: number;
    totalPages?: number;
    currentPage?: number;
  },
): ApiResponse<T> => ({
  success: true,
  statusCode: 200,
  message: message || null,
  data,
  metadata: {
    count: metadata?.count,
    totalPages: metadata?.totalPages,
    currentPage: metadata?.currentPage,
    timestamp: new Date().toISOString(),
    version: '1.0',
  },
});

/**
 * Format error response
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param errors - Optional validation errors object
 */
export const formatError = (
  statusCode: number,
  message: string,
  errors?: Record<string, string | string[]>,
): ApiError => ({
  success: false,
  statusCode,
  message,
  errors,
  data: null,
});

/**
 * Format created response (201)
 */
export const formatCreated = <T>(
  data: T,
  message?: string,
): ApiResponse<T> => ({
  success: true,
  statusCode: 201,
  message: message || 'Resource created successfully',
  data,
  metadata: {
    timestamp: new Date().toISOString(),
  },
});

/**
 * Format paginated response
 */
export const formatPaginated = <T>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number,
): ApiResponse<T[]> => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    success: true,
    statusCode: 200,
    data,
    metadata: {
      count: data.length,
      totalPages,
      currentPage: page,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Format no content response (204)
 */
export const formatNoContent = (): Omit<ApiResponse, 'data'> & {
  data: null;
} => ({
  success: true,
  statusCode: 204,
  data: null,
  metadata: {
    timestamp: new Date().toISOString(),
  },
});

/**
 * Express middleware helper - sends formatted response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
): void => {
  res
    .status(statusCode)
    .json(
      statusCode === 201
        ? formatCreated(data, message)
        : formatSuccess(data, message),
    );
};

/**
 * Express middleware helper - sends formatted error
 */
export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: Record<string, string | string[]>,
): void => {
  res.status(statusCode).json(formatError(statusCode, message, errors));
};
