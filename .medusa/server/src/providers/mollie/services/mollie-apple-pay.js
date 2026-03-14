"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieApplePayService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.applepay,
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.APPLE_PAY +
                "_mollie",
            captureMethod: api_client_1.CaptureMethod.automatic,
        };
    }
}
MollieApplePayService.identifier = types_1.PaymentProviderKeys.APPLE_PAY;
exports.default = MollieApplePayService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWFwcGxlLXBheS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvbW9sbGllL3NlcnZpY2VzL21vbGxpZS1hcHBsZS1wYXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtREFBa0U7QUFDbEUsc0VBQTZDO0FBQzdDLG9DQUErRDtBQUUvRCxNQUFNLHFCQUFzQixTQUFRLHFCQUFVO0lBRzVDLElBQUksb0JBQW9CO1FBQ3RCLE9BQU87WUFDTCxNQUFNLEVBQUUsMEJBQWEsQ0FBQyxRQUFRO1lBQzlCLFVBQVUsRUFDUixJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVM7Z0JBQ3ZCLGlCQUFpQjtnQkFDakIsMkJBQW1CLENBQUMsU0FBUztnQkFDN0IsU0FBUztZQUNYLGFBQWEsRUFBRSwwQkFBYSxDQUFDLFNBQVM7U0FDdkMsQ0FBQztJQUNKLENBQUM7O0FBWk0sZ0NBQVUsR0FBRywyQkFBbUIsQ0FBQyxTQUFTLENBQUM7QUFlcEQsa0JBQWUscUJBQXFCLENBQUMifQ==