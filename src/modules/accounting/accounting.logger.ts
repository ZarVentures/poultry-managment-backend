import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AccountingLogger extends Logger {
  constructor() {
    super('AccountingIntegration');
  }

  logTransaction(type: string, id: string, amount: number, party: string) {
    this.log(`[Transaction] Type: ${type} | ID: ${id} | Amount: ${amount} | Party: ${party}`);
  }

  logApiRequest(method: string, url: string, payload: any) {
    this.log(`[API Request] ${method} ${url} | Payload: ${JSON.stringify(payload)}`);
  }

  logApiResponse(method: string, url: string, status: number, data?: any) {
    this.log(`[API Response] ${method} ${url} | Status: ${status} | Data: ${JSON.stringify(data || {})}`);
  }

  logFailedRequest(txnId: string, error: string, willRetry: boolean) {
    const statusText = willRetry ? 'Queueing for retry' : 'Max retries exceeded / Ignored';
    this.error(`[Sync Failed] ID: ${txnId} | Error: ${error} | Status: ${statusText}`);
  }

  logRetryAttempt(jobId: string, attempt: number, status: 'SUCCESS' | 'FAILED', error?: string) {
    if (status === 'SUCCESS') {
      this.log(`[Retry Success] Job ID: ${jobId} | Attempt: ${attempt}`);
    } else {
      this.warn(`[Retry Failed] Job ID: ${jobId} | Attempt: ${attempt} | Error: ${error || 'Unknown'}`);
    }
  }

  logValidationError(txnId: string, errors: string[]) {
    this.error(`[Validation Failed] ID: ${txnId} | Errors: ${errors.join(', ')}`);
  }
}
