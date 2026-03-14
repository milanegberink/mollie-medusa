import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieCardService extends MollieBase {
  static identifier = PaymentProviderKeys.CREDIT_CARD;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.creditcard,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.CREDIT_CARD +
        "_mollie",
      captureMethod:
        this.options_.autoCapture !== false
          ? CaptureMethod.automatic
          : CaptureMethod.manual,
    };
  }
}

export default MollieCardService;
