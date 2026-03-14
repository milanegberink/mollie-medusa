"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieBancontactService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.bancontact,
            webhookUrl: this.options_.medusaUrl +
                "/hooks/payment/" +
                types_1.PaymentProviderKeys.BANCONTACT +
                "_mollie",
            captureMethod: api_client_1.CaptureMethod.automatic,
        };
    }
}
MollieBancontactService.identifier = types_1.PaymentProviderKeys.BANCONTACT;
exports.default = MollieBancontactService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWJhbmNvbnRhY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL21vbGxpZS9zZXJ2aWNlcy9tb2xsaWUtYmFuY29udGFjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1EQUFrRTtBQUNsRSxzRUFBNkM7QUFDN0Msb0NBQStEO0FBRS9ELE1BQU0sdUJBQXdCLFNBQVEscUJBQVU7SUFHOUMsSUFBSSxvQkFBb0I7UUFDdEIsT0FBTztZQUNMLE1BQU0sRUFBRSwwQkFBYSxDQUFDLFVBQVU7WUFDaEMsVUFBVSxFQUNSLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUztnQkFDdkIsaUJBQWlCO2dCQUNqQiwyQkFBbUIsQ0FBQyxVQUFVO2dCQUM5QixTQUFTO1lBQ1gsYUFBYSxFQUFFLDBCQUFhLENBQUMsU0FBUztTQUN2QyxDQUFDO0lBQ0osQ0FBQzs7QUFaTSxrQ0FBVSxHQUFHLDJCQUFtQixDQUFDLFVBQVUsQ0FBQztBQWVyRCxrQkFBZSx1QkFBdUIsQ0FBQyJ9