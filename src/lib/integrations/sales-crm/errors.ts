export class SalesCrmError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SalesCrmError";
  }
}

export class SalesCrmNotConnectedError extends SalesCrmError {
  constructor(message = "Sales CRM is not connected") {
    super(message, "not_connected");
    this.name = "SalesCrmNotConnectedError";
  }
}

export class SalesCrmConfigurationError extends SalesCrmError {
  constructor(message: string) {
    super(message, "not_configured");
    this.name = "SalesCrmConfigurationError";
  }
}
