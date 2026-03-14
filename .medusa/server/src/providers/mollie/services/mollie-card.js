"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieCardService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.creditcard,
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.CREDIT_CARD +
                "_mollie",
            captureMethod: this.options_.autoCapture !== false
                ? api_client_1.CaptureMethod.automatic
                : api_client_1.CaptureMethod.manual,
        };
    }
}
MollieCardService.identifier = types_1.PaymentProviderKeys.CREDIT_CARD;
exports.default = MollieCardService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWNhcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL21vbGxpZS9zZXJ2aWNlcy9tb2xsaWUtY2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1EQUFrRTtBQUNsRSxzRUFBNkM7QUFDN0Msb0NBQStEO0FBRS9ELE1BQU0saUJBQWtCLFNBQVEscUJBQVU7SUFHeEMsSUFBSSxvQkFBb0I7UUFDdEIsT0FBTztZQUNMLE1BQU0sRUFBRSwwQkFBYSxDQUFDLFVBQVU7WUFDaEMsVUFBVSxFQUNSLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUztnQkFDdkIsaUJBQWlCO2dCQUNqQiwyQkFBbUIsQ0FBQyxXQUFXO2dCQUMvQixTQUFTO1lBQ1gsYUFBYSxFQUNYLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxLQUFLLEtBQUs7Z0JBQ2pDLENBQUMsQ0FBQywwQkFBYSxDQUFDLFNBQVM7Z0JBQ3pCLENBQUMsQ0FBQywwQkFBYSxDQUFDLE1BQU07U0FDM0IsQ0FBQztJQUNKLENBQUM7O0FBZk0sNEJBQVUsR0FBRywyQkFBbUIsQ0FBQyxXQUFXLENBQUM7QUFrQnRELGtCQUFlLGlCQUFpQixDQUFDIn0=