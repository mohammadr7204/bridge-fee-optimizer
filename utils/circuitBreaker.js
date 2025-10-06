// Circuit breaker pattern for handling API failures
export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.threshold = options.threshold || 5; // Failures before opening
    this.timeout = options.timeout || 60000; // Time before retry (ms)
    this.halfOpenRequests = options.halfOpenRequests || 1; // Requests in half-open state
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.halfOpenAttempts = 0;
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastFailure: null,
      lastSuccess: null,
      stateChanges: []
    };
  }

  async execute(fn) {
    this.metrics.totalRequests++;
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is open');
      }
      // Move to half-open state
      this.changeState('HALF_OPEN');
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenAttempts >= this.halfOpenRequests) {
      throw new Error('Circuit breaker is testing, please retry');
    }

    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenAttempts++;
      }

      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.successes++;
    this.metrics.totalSuccesses++;
    this.metrics.lastSuccess = new Date().toISOString();

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.halfOpenRequests) {
        this.changeState('CLOSED');
      }
    }
  }

  onFailure() {
    this.failures++;
    this.successes = 0;
    this.metrics.totalFailures++;
    this.metrics.lastFailure = new Date().toISOString();

    if (this.state === 'HALF_OPEN') {
      this.changeState('OPEN');
    } else if (this.failures >= this.threshold) {
      this.changeState('OPEN');
    }
  }

  changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString()
    });

    switch (newState) {
      case 'OPEN':
        this.nextAttempt = Date.now() + this.timeout;
        this.halfOpenAttempts = 0;
        console.warn(`Circuit breaker ${this.name} opened after ${this.failures} failures`);
        break;
      case 'HALF_OPEN':
        this.halfOpenAttempts = 0;
        this.successes = 0;
        console.info(`Circuit breaker ${this.name} half-open, testing...`);
        break;
      case 'CLOSED':
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
        console.info(`Circuit breaker ${this.name} closed`);
        break;
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
      metrics: this.metrics
    };
  }

  getRetryAfter() {
    if (this.state === 'OPEN' && this.nextAttempt > Date.now()) {
      return Math.ceil((this.nextAttempt - Date.now()) / 1000);
    }
    return 0;
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.halfOpenAttempts = 0;
    console.info(`Circuit breaker ${this.name} manually reset`);
  }
}