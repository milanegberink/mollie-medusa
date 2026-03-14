import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieApplePayService extends MollieBase {
  static identifier = PaymentProviderKeys.APPLE_PAY;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.applepay,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.APPLE_PAY +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
    };
  }
}

export default MollieApplePayService;
