import { CaptureMethod, PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieBancontactService extends MollieBase {
  static identifier = PaymentProviderKeys.BANCONTACT;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.bancontact,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        PaymentProviderKeys.BANCONTACT +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
    };
  }
}

export default MollieBancontactService;
