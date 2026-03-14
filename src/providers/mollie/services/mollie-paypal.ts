import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MolliePaypalService extends MollieBase {
  static identifier = PaymentProviderKeys.PAYPAL;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.paypal,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.PAYPAL +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
    };
  }
}

export default MolliePaypalService;
