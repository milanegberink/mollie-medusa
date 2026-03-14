import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieIdealService extends MollieBase {
  static identifier = PaymentProviderKeys.IDEAL;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.ideal,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.IDEAL +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
    };
  }
}

export default MollieIdealService;
