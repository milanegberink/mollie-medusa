"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@mollie/api-client");
const mollie_base_1 = __importDefault(require("../core/mollie-base"));
const types_1 = require("../types");
class MollieKlarnaService extends mollie_base_1.default {
    get paymentCreateOptions() {
        return {
            method: api_client_1.PaymentMethod.klarnapaylater,
        };
    }
}
MollieKlarnaService.identifier = types_1.PaymentProviderKeys.KLARNA;
exports.default = MollieKlarnaService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWtsYXJuYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvbW9sbGllL3NlcnZpY2VzL21vbGxpZS1rbGFybmEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtREFBbUQ7QUFDbkQsc0VBQTZDO0FBQzdDLG9DQUErRDtBQUUvRCxNQUFNLG1CQUFvQixTQUFRLHFCQUFVO0lBRzFDLElBQUksb0JBQW9CO1FBQ3RCLE9BQU87WUFDTCxNQUFNLEVBQUUsMEJBQWEsQ0FBQyxjQUFjO1NBQ3JDLENBQUM7SUFDSixDQUFDOztBQU5NLDhCQUFVLEdBQUcsMkJBQW1CLENBQUMsTUFBTSxDQUFDO0FBU2pELGtCQUFlLG1CQUFtQixDQUFDIn0=