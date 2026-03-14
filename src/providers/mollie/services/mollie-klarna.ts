import { PaymentMethod } from "@mollie/api-client";
import MollieBase from "../core/mollie-base";
import { PaymentOptions, PaymentProviderKeys } from "../types";

class MollieKlarnaService extends MollieBase {
  static identifier = PaymentProviderKeys.KLARNA;

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.klarna,
    };
  }
}

export default MollieKlarnaService;
