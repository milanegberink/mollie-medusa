"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieIdealService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.ideal,
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.IDEAL +
                "_mollie",
            captureMethod: api_client_1.CaptureMethod.automatic,
        };
    }
}
MollieIdealService.identifier = types_1.PaymentProviderKeys.IDEAL;
exports.default = MollieIdealService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWlkZWFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy9tb2xsaWUvc2VydmljZXMvbW9sbGllLWlkZWFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbURBQWtFO0FBQ2xFLHNFQUE2QztBQUM3QyxvQ0FBK0Q7QUFFL0QsTUFBTSxrQkFBbUIsU0FBUSxxQkFBVTtJQUd6QyxJQUFJLG9CQUFvQjtRQUN0QixPQUFPO1lBQ0wsTUFBTSxFQUFFLDBCQUFhLENBQUMsS0FBSztZQUMzQixVQUFVLEVBQ1IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO2dCQUN2QixpQkFBaUI7Z0JBQ2pCLDJCQUFtQixDQUFDLEtBQUs7Z0JBQ3pCLFNBQVM7WUFDWCxhQUFhLEVBQUUsMEJBQWEsQ0FBQyxTQUFTO1NBQ3ZDLENBQUM7SUFDSixDQUFDOztBQVpNLDZCQUFVLEdBQUcsMkJBQW1CLENBQUMsS0FBSyxDQUFDO0FBZWhELGtCQUFlLGtCQUFrQixDQUFDIn0=