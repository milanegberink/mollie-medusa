import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieGiftcardService extends MollieBase {
  static identifier = PaymentProviderKeys.GIFT_CARD;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.giftcard,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.GIFT_CARD +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
    };
  }
}

export default MollieGiftcardService;
