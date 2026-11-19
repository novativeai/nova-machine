/**
 * User-friendly error messages for Fal.ai API errors
 */

export interface ParsedError {
  message: string;
  code: string;
  isRetryable: boolean;
  retryAfter?: number;
}

/**
 * Common error codes and their user-friendly messages
 */
const ERROR_MESSAGES: Record<string, { message: string; isRetryable: boolean }> = {
  API_KEY_REQUIRED: {
    message: 'Please add your Fal.ai API key in Settings to continue.',
    isRetryable: false,
  },
  INVALID_API_KEY: {
    message: 'Your fal.ai API key was rejected. Check it with the key button in the header, or create a new one at fal.ai/dashboard/keys.',
    isRetryable: false,
  },
  RATE_LIMITED: {
    message: 'Too many requests. Please wait a moment before trying again.',
    isRetryable: true,
  },
  INSUFFICIENT_BALANCE: {
    message: 'Your fal.ai account balance is too low. Top it up at fal.ai/dashboard/billing and try again.',
    isRetryable: false,
  },
  FILE_TOO_LARGE: {
    message: 'File is too large. Maximum size is 100MB.',
    isRetryable: false,
  },
  INVALID_FILE_TYPE: {
    message: 'Invalid file type. Please use JPEG, PNG, GIF, WebP, MP4, WebM, or MOV.',
    isRetryable: false,
  },
  NETWORK_ERROR: {
    message: 'Network error. Please check your connection and try again.',
    isRetryable: true,
  },
  TIMEOUT: {
    message: 'Request timed out. Please try again.',
    isRetryable: true,
  },
  MODEL_BUSY: {
    message: 'The AI model is currently busy. Please try again in a moment.',
    isRetryable: true,
  },
  CONTENT_MODERATION: {
    message: 'Your request was flagged by content moderation. Please revise your prompt.',
    isRetryable: false,
  },
  GENERATION_FAILED: {
    message: 'Generation failed. Please try with a different prompt or settings.',
    isRetryable: true,
  },
};

/**
 * Parse an error from Fal.ai API or our routes and return user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  // Handle our custom error format with code
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    const knownError = ERROR_MESSAGES[code];

    if (knownError) {
      return {
        message: knownError.message,
        code,
        isRetryable: knownError.isRetryable,
        retryAfter: 'retryAfter' in error ? (error as { retryAfter: number }).retryAfter : undefined,
      };
    }
  }

  // Handle HTTP status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;

    if (status === 401 || status === 403) {
      return {
        message: 'Authentication failed. Please check your API key in Settings.',
        code: 'AUTH_ERROR',
        isRetryable: false,
      };
    }

    if (status === 429) {
      return {
        message: 'Too many requests. Please wait before trying again.',
        code: 'RATE_LIMITED',
        isRetryable: true,
        retryAfter: 'retryAfter' in error ? (error as { retryAfter: number }).retryAfter : 60,
      };
    }

    if (status === 402) {
      return {
        message: 'Your fal.ai account balance is too low. Top it up at fal.ai/dashboard/billing and try again.',
        code: 'INSUFFICIENT_BALANCE',
        isRetryable: false,
      };
    }

    if (status >= 500) {
      return {
        message: 'Server error. Please try again in a moment.',
        code: 'SERVER_ERROR',
        isRetryable: true,
      };
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for common error patterns
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('authentication')) {
      return {
        message: 'Authentication error. Please check your API key in Settings.',
        code: 'AUTH_ERROR',
        isRetryable: false,
      };
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        message: 'Too many requests. Please wait before trying again.',
        code: 'RATE_LIMITED',
        isRetryable: true,
      };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
        isRetryable: true,
      };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT',
        isRetryable: true,
      };
    }

    if (message.includes('content') && message.includes('moderat')) {
      return {
        message: 'Content moderation flagged your request. Please revise your prompt.',
        code: 'CONTENT_MODERATION',
        isRetryable: false,
      };
    }

    // Return the original message if no pattern matched
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      isRetryable: true,
    };
  }

  // Fallback for unknown error types
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    isRetryable: true,
  };
}

/**
 * Format error for display to user
 */
export function formatErrorForDisplay(error: unknown): string {
  const parsed = parseError(error);
  return parsed.message;
}
