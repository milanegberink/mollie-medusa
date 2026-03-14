import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import {
  MollieApplePayService,
  MollieBancontactService,
  MollieCardService,
  MollieGiftcardService,
  MollieIdealService,
  MolliePaypalService,
  MollieProviderService,
  MollieKlarnaService,
} from "./services";

const services = [
  MollieApplePayService,
  MollieBancontactService,
  MollieKlarnaService,
  MollieCardService,
  MollieGiftcardService,

  MollieIdealService,
  MolliePaypalService,
  MollieProviderService,
];

export default ModuleProvider(Modules.PAYMENT, {
  services,
});
