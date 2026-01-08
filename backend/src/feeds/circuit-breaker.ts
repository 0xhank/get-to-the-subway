// Circuit breaker pattern for feed failure handling
// Opens after 3 consecutive failures, closes after 1 success

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  recoveryTimeoutMs: number; // Time before attempting recovery
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryTimeoutMs: 60_000,
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(
    public readonly feedId: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isOpen(): boolean {
    if (this.state === "CLOSED") {
      return false;
    }

    // Check if we should transition to half-open
    if (
      this.state === "OPEN" &&
      Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs
    ) {
      this.state = "HALF_OPEN";
      return false; // Allow one request through
    }

    return this.state === "OPEN";
  }

  get currentState(): CircuitState {
    // Trigger state check
    this.isOpen;
    return this.state;
  }

  get failures(): number {
    return this.failureCount;
  }

  recordSuccess(): void {
    // Single success closes the circuit (as decided in interview)
    this.state = "CLOSED";
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = "OPEN";
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
