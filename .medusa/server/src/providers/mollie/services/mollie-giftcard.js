"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _apiclient = require("@mollie/api-client");
const _molliebase = /*#__PURE__*/ _interop_require_default(require("../core/mollie-base"));
const _types = require("../types");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let MollieGiftcardService = class MollieGiftcardService extends _molliebase.default {
    get paymentCreateOptions() {
        return {
            method: _apiclient.PaymentMethod.giftcard,
            webhookUrl: this.options_.medusaUrl + "/hooks/payment/" + _types.PaymentProviderKeys.GIFT_CARD + "_mollie",
            captureMethod: _apiclient.CaptureMethod.automatic
        };
    }
};
_define_property(MollieGiftcardService, "identifier", _types.PaymentProviderKeys.GIFT_CARD);
const _default = MollieGiftcardService;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wcm92aWRlcnMvbW9sbGllL3NlcnZpY2VzL21vbGxpZS1naWZ0Y2FyZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDYXB0dXJlTWV0aG9kLCBQYXltZW50TWV0aG9kIH0gZnJvbSBcIkBtb2xsaWUvYXBpLWNsaWVudFwiO1xuaW1wb3J0IE1vbGxpZUJhc2UgZnJvbSBcIi4uL2NvcmUvbW9sbGllLWJhc2VcIjtcbmltcG9ydCB7IFBheW1lbnRPcHRpb25zLCBQYXltZW50UHJvdmlkZXJLZXlzIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNsYXNzIE1vbGxpZUdpZnRjYXJkU2VydmljZSBleHRlbmRzIE1vbGxpZUJhc2Uge1xuICBzdGF0aWMgaWRlbnRpZmllciA9IFBheW1lbnRQcm92aWRlcktleXMuR0lGVF9DQVJEO1xuXG4gIGdldCBwYXltZW50Q3JlYXRlT3B0aW9ucygpOiBQYXltZW50T3B0aW9ucyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1ldGhvZDogUGF5bWVudE1ldGhvZC5naWZ0Y2FyZCxcbiAgICAgIHdlYmhvb2tVcmw6XG4gICAgICAgIHRoaXMub3B0aW9uc18ubWVkdXNhVXJsICtcbiAgICAgICAgXCIvaG9va3MvcGF5bWVudC9cIiArXG4gICAgICAgIFBheW1lbnRQcm92aWRlcktleXMuR0lGVF9DQVJEICtcbiAgICAgICAgXCJfbW9sbGllXCIsXG4gICAgICBjYXB0dXJlTWV0aG9kOiBDYXB0dXJlTWV0aG9kLmF1dG9tYXRpYyxcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1vbGxpZUdpZnRjYXJkU2VydmljZTtcbiJdLCJuYW1lcyI6WyJNb2xsaWVHaWZ0Y2FyZFNlcnZpY2UiLCJNb2xsaWVCYXNlIiwicGF5bWVudENyZWF0ZU9wdGlvbnMiLCJtZXRob2QiLCJQYXltZW50TWV0aG9kIiwiZ2lmdGNhcmQiLCJ3ZWJob29rVXJsIiwib3B0aW9uc18iLCJtZWR1c2FVcmwiLCJQYXltZW50UHJvdmlkZXJLZXlzIiwiR0lGVF9DQVJEIiwiY2FwdHVyZU1ldGhvZCIsIkNhcHR1cmVNZXRob2QiLCJhdXRvbWF0aWMiLCJpZGVudGlmaWVyIl0sInJhbmdlTWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsIm1hcHBpbmdzIjoiOzs7OytCQW9CQTs7O2VBQUE7OzsyQkFwQjZDO21FQUN0Qjt1QkFDNkI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFcEQsSUFBQSxBQUFNQSx3QkFBTixNQUFNQSw4QkFBOEJDLG1CQUFVO0lBRzVDLElBQUlDLHVCQUF1QztRQUN6QyxPQUFPO1lBQ0xDLFFBQVFDLHdCQUFhLENBQUNDLFFBQVE7WUFDOUJDLFlBQ0UsSUFBSSxDQUFDQyxRQUFRLENBQUNDLFNBQVMsR0FDdkIsb0JBQ0FDLDBCQUFtQixDQUFDQyxTQUFTLEdBQzdCO1lBQ0ZDLGVBQWVDLHdCQUFhLENBQUNDLFNBQVM7UUFDeEM7SUFDRjtBQUNGO0FBYkUsaUJBREliLHVCQUNHYyxjQUFhTCwwQkFBbUIsQ0FBQ0MsU0FBUztNQWVuRCxXQUFlViJ9