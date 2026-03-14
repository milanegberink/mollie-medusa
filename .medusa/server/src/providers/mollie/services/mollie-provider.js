"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieProviderService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.MOLLIE_HOSTED_CHECKOUT +
                "_mollie",
        };
    }
}
MollieProviderService.identifier = types_1.PaymentProviderKeys.MOLLIE_HOSTED_CHECKOUT;
exports.default = MollieProviderService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy9tb2xsaWUvc2VydmljZXMvbW9sbGllLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0VBQTZDO0FBQzdDLG9DQUErRDtBQUUvRCxNQUFNLHFCQUFzQixTQUFRLHFCQUFVO0lBRzVDLElBQUksb0JBQW9CO1FBQ3RCLE9BQU87WUFDTCxVQUFVLEVBQ1IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO2dCQUN2QixpQkFBaUI7Z0JBQ2pCLDJCQUFtQixDQUFDLHNCQUFzQjtnQkFDMUMsU0FBUztTQUNaLENBQUM7SUFDSixDQUFDOztBQVZNLGdDQUFVLEdBQUcsMkJBQW1CLENBQUMsc0JBQXNCLENBQUM7QUFhakUsa0JBQWUscUJBQXFCLENBQUMifQ==