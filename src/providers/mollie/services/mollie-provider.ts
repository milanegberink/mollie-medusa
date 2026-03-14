import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieProviderService extends MollieBase {
  static identifier = PaymentProviderKeys.MOLLIE_HOSTED_CHECKOUT;

  get paymentCreateOptions(): PaymentOptions {
    return {
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.MOLLIE_HOSTED_CHECKOUT +
        "_mollie",
    };
  }
}

export default MollieProviderService;
