"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieGiftcardService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.giftcard,
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.GIFT_CARD +
                "_mollie",
            captureMethod: api_client_1.CaptureMethod.automatic,
        };
    }
}
MollieGiftcardService.identifier = types_1.PaymentProviderKeys.GIFT_CARD;
exports.default = MollieGiftcardService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWdpZnRjYXJkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy9tb2xsaWUvc2VydmljZXMvbW9sbGllLWdpZnRjYXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbURBQWtFO0FBQ2xFLHNFQUE2QztBQUM3QyxvQ0FBK0Q7QUFFL0QsTUFBTSxxQkFBc0IsU0FBUSxxQkFBVTtJQUc1QyxJQUFJLG9CQUFvQjtRQUN0QixPQUFPO1lBQ0wsTUFBTSxFQUFFLDBCQUFhLENBQUMsUUFBUTtZQUM5QixVQUFVLEVBQ1IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO2dCQUN2QixpQkFBaUI7Z0JBQ2pCLDJCQUFtQixDQUFDLFNBQVM7Z0JBQzdCLFNBQVM7WUFDWCxhQUFhLEVBQUUsMEJBQWEsQ0FBQyxTQUFTO1NBQ3ZDLENBQUM7SUFDSixDQUFDOztBQVpNLGdDQUFVLEdBQUcsMkJBQW1CLENBQUMsU0FBUyxDQUFDO0FBZXBELGtCQUFlLHFCQUFxQixDQUFDIn0=