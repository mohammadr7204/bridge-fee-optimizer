// Input validation and sanitization utilities
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1000000;

export function validateInput(params) {
  const errors = [];
  const details = {};

  // Validate fromChain
  if (!params.fromChain) {
    errors.push('Source chain is required');
    details.fromChain = 'missing';
  } else if (!SUPPORTED_CHAINS.includes(params.fromChain)) {
    errors.push('Invalid source chain');
    details.fromChain = 'invalid';
  }

  // Validate toChain
  if (!params.toChain) {
    errors.push('Destination chain is required');
    details.toChain = 'missing';
  } else if (!SUPPORTED_CHAINS.includes(params.toChain)) {
    errors.push('Invalid destination chain');
    details.toChain = 'invalid';
  }

  // Validate chains are different
  if (params.fromChain === params.toChain) {
    errors.push('Source and destination chains must be different');
    details.chains = 'same';
  }

  // Validate amount
  if (!params.amount) {
    errors.push('Amount is required');
    details.amount = 'missing';
  } else {
    const amount = parseFloat(params.amount);
    
    if (isNaN(amount)) {
      errors.push('Amount must be a number');
      details.amount = 'invalid';
    } else if (amount < MIN_AMOUNT) {
      errors.push(`Minimum amount is $${MIN_AMOUNT}`);
      details.amount = 'too_small';
    } else if (amount > MAX_AMOUNT) {
      errors.push(`Maximum amount is $${MAX_AMOUNT}`);
      details.amount = 'too_large';
    }
  }

  // Check for SQL injection patterns
  const sqlPatterns = [
    /('|"|--)/, // Basic SQL injection
    /(union|select|insert|update|delete|drop|create|alter|exec|execute|script)/i,
    /(\x00|\n|\r|\x1a)/ // Null bytes and special chars
  ];

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          errors.push(`Invalid characters in ${key}`);
          details[key] = 'malicious_input';
          break;
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    details
  };
}

export function sanitizeInput(params) {
  const sanitized = {};

  // Sanitize string inputs
  if (params.fromChain) {
    sanitized.fromChain = DOMPurify.sanitize(params.fromChain.toLowerCase().trim());
    sanitized.fromChain = validator.escape(sanitized.fromChain);
  }

  if (params.toChain) {
    sanitized.toChain = DOMPurify.sanitize(params.toChain.toLowerCase().trim());
    sanitized.toChain = validator.escape(sanitized.toChain);
  }

  // Sanitize numeric input
  if (params.amount) {
    const amount = parseFloat(params.amount);
    if (!isNaN(amount)) {
      // Round to 2 decimal places and ensure it's within bounds
      sanitized.amount = Math.min(Math.max(amount, MIN_AMOUNT), MAX_AMOUNT).toFixed(2);
    }
  }

  // Remove any additional parameters that shouldn't be there
  const allowedParams = ['fromChain', 'toChain', 'amount', 'bridge'];
  Object.keys(params).forEach(key => {
    if (!allowedParams.includes(key)) {
      console.warn(`Removed unexpected parameter: ${key}`);
    }
  });

  return sanitized;
}

export function validateAddress(address, chain) {
  // Ethereum-compatible address validation
  const ethChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'];
  
  if (ethChains.includes(chain)) {
    // Check if it's a valid Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return false;
    }
    
    // Could add checksum validation here if needed
    return true;
  }
  
  // Add other chain validations as needed
  return false;
}

export function sanitizeOutput(data) {
  // Sanitize any data being sent back to the client
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeOutput(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeOutput(value);
    }
    return sanitized;
  }
  
  return data;
}