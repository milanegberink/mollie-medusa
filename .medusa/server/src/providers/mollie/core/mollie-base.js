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
const _utils = require("@medusajs/framework/utils");
const _apiclient = /*#__PURE__*/ _interop_require_wildcard(require("@mollie/api-client"));
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
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
/**
 * Implementation of Mollie Payment Provider for Medusa
 */ let MollieBase = class MollieBase extends _utils.AbstractPaymentProvider {
    /**
   * Validates that the required options are provided
   * @param options - The options to validate
   * @throws {MedusaError} If API key is missing
   */ static validateOptions(options) {
        if (!options.apiKey || !options.redirectUrl || !options.medusaUrl) {
            throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, "API key, redirect URL, and Medusa URL are required in the provider's options.");
        }
    }
    normalizePaymentCreateParams() {
        const res = {};
        if (this.paymentCreateOptions.method) {
            res.method = this.paymentCreateOptions.method;
        }
        res.webhookUrl = this.paymentCreateOptions.webhookUrl;
        res.captureMode = this.paymentCreateOptions.captureMethod ?? (this.options_.autoCapture !== false ? _apiclient.CaptureMethod.automatic : _apiclient.CaptureMethod.manual);
        return res;
    }
    /**
   * Initiates a new payment with Mollie
   * @param input - The payment initiation input
   * @returns The initiated payment details
   */ async initiatePayment({ data, context, amount, currency_code }) {
        const shippingTotal = data?.shipping_total;
        const normalizedParams = this.normalizePaymentCreateParams();
        const billing = data?.billing_address ?? context?.customer?.billing_address;
        const email = data?.email ?? context?.customer?.email;
        const lines = [
            ...(data?.items ?? []).map((item)=>({
                    type: "physical",
                    name: item.title || item.variant?.product?.title || "Product",
                    description: item.title || item.variant?.product?.title || "Product",
                    quantity: item.quantity,
                    unitPrice: {
                        currency: currency_code.toUpperCase(),
                        value: item.unit_price
                    },
                    totalAmount: {
                        currency: currency_code.toUpperCase(),
                        value: (item.unit_price * item.quantity).toFixed(2)
                    },
                    vatRate: "0.00",
                    vatAmount: {
                        currency: currency_code.toUpperCase(),
                        value: "0.00"
                    }
                })),
            // Only append shipping line if there's a shipping cost
            ...shippingTotal > 0 ? [
                {
                    type: "shipping_fee",
                    name: "Shipping",
                    description: "Shipping",
                    quantity: 1,
                    unitPrice: {
                        currency: currency_code.toUpperCase(),
                        value: shippingTotal.toFixed(2)
                    },
                    totalAmount: {
                        currency: currency_code.toUpperCase(),
                        value: shippingTotal.toFixed(2)
                    },
                    vatRate: "0.00",
                    vatAmount: {
                        currency: currency_code.toUpperCase(),
                        value: "0.00"
                    }
                }
            ] : []
        ];
        console.dir(lines, {
            depth: null
        });
        try {
            const createParams = {
                ...normalizedParams,
                billingAddress: {
                    streetAndNumber: billing?.address_1 || "",
                    givenName: billing?.first_name || "",
                    familyName: billing?.last_name || "",
                    email,
                    postalCode: billing?.postal_code || "",
                    city: billing?.city || "",
                    country: billing?.country_code || ""
                },
                billingEmail: email || "",
                lines,
                amount: {
                    value: parseFloat(amount.toString()).toFixed(2),
                    currency: currency_code.toUpperCase()
                },
                description: this.options_.description || "Mollie payment created by Medusa",
                redirectUrl: this.options_.redirectUrl,
                metadata: {
                    idempotency_key: context?.idempotency_key
                }
            };
            const data = await this.client_.payments.create(createParams).then((payment)=>{
                return payment;
            }).catch((error)=>{
                this.logger_.error(`Mollie payment creation failed: ${error.message}`);
                throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, error.message);
            });
            this.debug_ && this.logger_.info(`Mollie payment ${data.id} successfully created with amount ${amount}`);
            return {
                id: data.id,
                data: data
            };
        } catch (error) {
            this.logger_.error(`Error initiating Mollie payment: ${error.message}`);
            throw error;
        }
    }
    /**
   * Checks if a payment is authorized with Mollie
   * @param input - The payment authorization input
   * @returns The authorization result
   */ async authorizePayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            const { status } = await this.getPaymentStatus({
                data: {
                    id: externalId
                }
            });
            if (![
                "captured",
                "authorized",
                "paid"
            ].includes(status)) {
                throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, `Payment is not authorized: current status is ${status}`);
            }
            this.debug_ && this.logger_.info(`Mollie payment ${externalId} successfully authorized with status ${status}`);
            return {
                data: input.data,
                status
            };
        } catch (error) {
            this.logger_.error(`Error authorizing payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Captures an authorized payment if autoCapture is disabled
   * @param input - The payment capture input
   * @returns The capture result
   */ async capturePayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            let status;
            const data = await this.retrievePayment({
                data: {
                    id: externalId
                }
            }).then(({ data })=>data);
            status = data?.status;
            const captureMode = data?.captureMode;
            if (status === _apiclient.PaymentStatus.authorized && captureMode === _apiclient.CaptureMethod.manual) {
                await this.client_.paymentCaptures.create({
                    paymentId: externalId
                });
            }
            status = await this.getPaymentStatus({
                data: {
                    id: externalId
                }
            }).then((res)=>res.status);
            if (status !== _utils.PaymentSessionStatus.CAPTURED) {
                throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, `Payment is not captured: current status is ${status}`);
            }
            this.debug_ && this.logger_.info(`Mollie payment ${externalId} captured with amount ${(input.data?.amount).currency_code} ${(input.data?.amount).value}`);
            const payment = await this.retrievePayment({
                data: {
                    id: externalId
                }
            });
            return {
                data: payment.data
            };
        } catch (error) {
            this.logger_.error(`Error capturing payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Refunds a payment
   * @param input - The payment refund input
   * @returns The refund result
   */ async refundPayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            const payment = await this.retrievePayment({
                data: {
                    id: externalId
                }
            });
            const value = (input.data?.amount).value;
            const currency = payment.data?.amount?.currency;
            if (!currency) {
                throw new _utils.MedusaError(_utils.MedusaError.Types.INVALID_DATA, "Currency information is missing from payment data");
            }
            const refund = await this.client_.paymentRefunds.create({
                paymentId: externalId,
                amount: {
                    value: parseFloat(value.toString()).toFixed(2),
                    currency: currency.toUpperCase()
                }
            });
            this.debug_ && this.logger_.info(`Refund for Mollie payment ${externalId} created with amount ${currency.toUpperCase()} ${parseFloat(value.toString()).toFixed(2)}`);
            return {
                data: {
                    ...refund
                }
            };
        } catch (error) {
            this.logger_.error(`Error refunding payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Cancels a payment
   * @param input - The payment cancellation input
   * @returns The cancellation result
   */ async cancelPayment(input) {
        const { id } = input.data;
        try {
            const payment = await this.client_.payments.get(id);
            if (payment.status === _apiclient.PaymentStatus.expired) {
                this.debug_ && this.logger_.info(`Mollie payment ${id} is already expired, no need to cancel`);
                return {
                    data: {
                        id: input.data?.id
                    }
                };
            }
            const newPayment = await this.client_.payments.cancel(id).catch((error)=>{
                this.logger_.warn(`Could not cancel Mollie payment ${id}: ${error.message}`);
                return {
                    data: payment
                };
            });
            this.debug_ && this.logger_.info(`Mollie payment ${id} cancelled successfully`);
            return {
                data: newPayment
            };
        } catch (error) {
            this.logger_.error(`Error cancelling payment ${id}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Deletes a payment (equivalent to cancellation as Mollie does not support deletion)
   * @param input - The payment deletion input
   * @returns The deletion result
   */ async deletePayment(input) {
        return this.cancelPayment(input);
    }
    /**
   * Gets the status of a payment by mapping Mollie statuses to Medusa statuses
   * @param input - The payment status input
   * @returns The payment status
   */ async getPaymentStatus(input) {
        const paymentId = input.data?.id;
        try {
            const { status } = await this.client_.payments.get(paymentId);
            const statusMap = {
                [_apiclient.PaymentStatus.open]: _utils.PaymentSessionStatus.REQUIRES_MORE,
                [_apiclient.PaymentStatus.canceled]: _utils.PaymentSessionStatus.CANCELED,
                [_apiclient.PaymentStatus.pending]: _utils.PaymentSessionStatus.PENDING,
                [_apiclient.PaymentStatus.authorized]: _utils.PaymentSessionStatus.AUTHORIZED,
                [_apiclient.PaymentStatus.expired]: _utils.PaymentSessionStatus.ERROR,
                [_apiclient.PaymentStatus.failed]: _utils.PaymentSessionStatus.ERROR,
                [_apiclient.PaymentStatus.paid]: _utils.PaymentSessionStatus.CAPTURED
            };
            const mappedStatus = statusMap[status];
            this.debug_ && this.logger_.debug(`Mollie payment ${paymentId} status: ${status} (mapped to: ${mappedStatus})`);
            return {
                status: mappedStatus
            };
        } catch (error) {
            this.logger_.error(`Error retrieving payment status for ${paymentId}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Retrieves payment details
   * @param input - The payment retrieval input
   * @returns The payment details
   */ async retrievePayment(input) {
        const paymentId = input.data?.id;
        try {
            const data = await this.client_.payments.get(paymentId);
            return {
                data: data
            };
        } catch (error) {
            this.logger_.error(`Error retrieving Mollie payment ${paymentId}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Updates a payment
   * @param input - The payment update input
   * @returns The updated payment details
   */ async updatePayment(input) {
        this.debug_ && this.logger_.info("Note: Mollie does not allow updating amounts on an existing payment. \n" + "Check https://docs.mollie.com/reference/update-payment for allowed updates.");
        const { id, description, redirectUrl, cancelUrl, webhookUrl, metadata, restrictPaymentMethodsToCountry } = input.data;
        try {
            const data = await this.client_.payments.update(id, {
                description,
                redirectUrl,
                cancelUrl,
                webhookUrl,
                metadata,
                restrictPaymentMethodsToCountry
            });
            this.debug_ && this.logger_.info(`Mollie payment ${id} successfully updated`);
            return {
                data: data
            };
        } catch (error) {
            this.logger_.error(`Error updating Mollie payment ${id}: ${error.message}`);
            throw error;
        }
    }
    /**
   * Processes webhook data from Mollie
   * @param payload - The webhook payload
   * @returns The action and data to be processed
   */ async getWebhookActionAndData(payload) {
        const { data } = payload;
        try {
            const { data: payment } = await this.retrievePayment({
                data: {
                    id: data.id
                }
            }).catch((e)=>{
                throw new _utils.MedusaError(_utils.MedusaError.Types.NOT_FOUND, e.message);
            });
            if (!payment) {
                throw new _utils.MedusaError(_utils.MedusaError.Types.NOT_FOUND, "Payment not found");
            }
            const status = payment?.status;
            const session_id = payment?.metadata?.idempotency_key;
            const amount = new _utils.BigNumber(payment?.amount);
            const baseData = {
                amount,
                session_id,
                ...payment
            };
            switch(status){
                case _apiclient.PaymentStatus.authorized:
                    return {
                        action: _utils.PaymentActions.AUTHORIZED,
                        data: baseData
                    };
                case _apiclient.PaymentStatus.paid:
                    return {
                        action: _utils.PaymentActions.SUCCESSFUL,
                        data: baseData
                    };
                case _apiclient.PaymentStatus.expired:
                case _apiclient.PaymentStatus.failed:
                    return {
                        action: _utils.PaymentActions.FAILED,
                        data: baseData
                    };
                case _apiclient.PaymentStatus.canceled:
                    return {
                        action: _utils.PaymentActions.CANCELED,
                        data: baseData
                    };
                case _apiclient.PaymentStatus.pending:
                    return {
                        action: _utils.PaymentActions.PENDING,
                        data: baseData
                    };
                case _apiclient.PaymentStatus.open:
                    return {
                        action: _utils.PaymentActions.REQUIRES_MORE,
                        data: baseData
                    };
                default:
                    return {
                        action: _utils.PaymentActions.NOT_SUPPORTED,
                        data: baseData
                    };
            }
        } catch (error) {
            this.logger_.error(`Error processing webhook for payment ${data.id}: ${error.message}`);
            // Even with errors, try to construct a valid response if we have the payment
            const { data: payment } = await this.retrievePayment({
                data: {
                    id: data.id
                }
            }).catch(()=>({
                    data: null
                }));
            if (payment) {
                return {
                    action: "failed",
                    data: {
                        session_id: payment?.metadata?.session_id,
                        amount: new _utils.BigNumber(payment?.amount),
                        ...payment
                    }
                };
            }
            throw error;
        }
    }
    /**
   * Creates a new instance of the Mollie payment provider
   * @param container - The dependency container
   * @param options - Configuration options
   */ constructor(container, options){
        super(container, options);
        _define_property(this, "options_", void 0);
        _define_property(this, "logger_", void 0);
        _define_property(this, "client_", void 0);
        _define_property(this, "debug_", void 0);
        this.logger_ = container.logger;
        this.options_ = options;
        this.debug_ = options.debug || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || false;
        this.client_ = (0, _apiclient.default)({
            apiKey: options.apiKey,
            versionStrings: [
                "MedusaJS/" + require("@medusajs/medusa/package.json").version,
                "VariableVic/" + process.env.npm_package_version
            ]
        });
    }
};
const _default = MollieBase;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wcm92aWRlcnMvbW9sbGllL2NvcmUvbW9sbGllLWJhc2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgTG9nZ2VyLFxuICBQcm92aWRlcldlYmhvb2tQYXlsb2FkLFxuICBXZWJob29rQWN0aW9uUmVzdWx0LFxufSBmcm9tIFwiQG1lZHVzYWpzL2ZyYW1ld29yay90eXBlc1wiO1xuaW1wb3J0IHtcbiAgQWJzdHJhY3RQYXltZW50UHJvdmlkZXIsXG4gIEJpZ051bWJlcixcbiAgTWVkdXNhRXJyb3IsXG4gIFBheW1lbnRBY3Rpb25zLFxuICBQYXltZW50U2Vzc2lvblN0YXR1cyxcbn0gZnJvbSBcIkBtZWR1c2Fqcy9mcmFtZXdvcmsvdXRpbHNcIjtcbmltcG9ydCB7XG4gIEF1dGhvcml6ZVBheW1lbnRJbnB1dCxcbiAgQXV0aG9yaXplUGF5bWVudE91dHB1dCxcbiAgQmlnTnVtYmVyUmF3VmFsdWUsXG4gIENhbmNlbFBheW1lbnRJbnB1dCxcbiAgQ2FuY2VsUGF5bWVudE91dHB1dCxcbiAgQ2FwdHVyZVBheW1lbnRJbnB1dCxcbiAgQ2FwdHVyZVBheW1lbnRPdXRwdXQsXG4gIERlbGV0ZVBheW1lbnRJbnB1dCxcbiAgRGVsZXRlUGF5bWVudE91dHB1dCxcbiAgR2V0UGF5bWVudFN0YXR1c0lucHV0LFxuICBHZXRQYXltZW50U3RhdHVzT3V0cHV0LFxuICBJbml0aWF0ZVBheW1lbnRJbnB1dCxcbiAgSW5pdGlhdGVQYXltZW50T3V0cHV0LFxuICBSZWZ1bmRQYXltZW50SW5wdXQsXG4gIFJlZnVuZFBheW1lbnRPdXRwdXQsXG4gIFJldHJpZXZlUGF5bWVudElucHV0LFxuICBSZXRyaWV2ZVBheW1lbnRPdXRwdXQsXG4gIFVwZGF0ZVBheW1lbnRJbnB1dCxcbiAgVXBkYXRlUGF5bWVudE91dHB1dCxcbn0gZnJvbSBcIkBtZWR1c2Fqcy90eXBlc1wiO1xuaW1wb3J0IGNyZWF0ZU1vbGxpZUNsaWVudCwge1xuICBDYXB0dXJlTWV0aG9kLFxuICBQYXltZW50Q3JlYXRlUGFyYW1zLFxuICBQYXltZW50TWV0aG9kLFxuICBQYXltZW50U3RhdHVzLFxufSBmcm9tIFwiQG1vbGxpZS9hcGktY2xpZW50XCI7XG5pbXBvcnQgeyBVcGRhdGVQYXJhbWV0ZXJzIH0gZnJvbSBcIkBtb2xsaWUvYXBpLWNsaWVudC9kaXN0L3R5cGVzL2JpbmRlcnMvcGF5bWVudHMvcGFyYW1ldGVyc1wiO1xuaW1wb3J0IHR5cGUge1xuICBQYXltZW50IGFzIFBheW1lbnREYXRhLFxuICBQYXltZW50TGluZVR5cGUsXG59IGZyb20gXCJAbW9sbGllL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IFBheW1lbnRPcHRpb25zLCBQcm92aWRlck9wdGlvbnMgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuLyoqXG4gKiBEZXBlbmRlbmNpZXMgaW5qZWN0ZWQgaW50byB0aGUgc2VydmljZVxuICovXG50eXBlIEluamVjdGVkRGVwZW5kZW5jaWVzID0ge1xuICBsb2dnZXI6IExvZ2dlcjtcbn07XG5cbi8qKlxuICogSW1wbGVtZW50YXRpb24gb2YgTW9sbGllIFBheW1lbnQgUHJvdmlkZXIgZm9yIE1lZHVzYVxuICovXG5hYnN0cmFjdCBjbGFzcyBNb2xsaWVCYXNlIGV4dGVuZHMgQWJzdHJhY3RQYXltZW50UHJvdmlkZXIge1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgb3B0aW9uc186IFByb3ZpZGVyT3B0aW9ucztcbiAgcHJvdGVjdGVkIGxvZ2dlcl86IExvZ2dlcjtcbiAgcHJvdGVjdGVkIGNsaWVudF86IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZU1vbGxpZUNsaWVudD47XG4gIHByb3RlY3RlZCBkZWJ1Z186IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlcyB0aGF0IHRoZSByZXF1aXJlZCBvcHRpb25zIGFyZSBwcm92aWRlZFxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHRvIHZhbGlkYXRlXG4gICAqIEB0aHJvd3Mge01lZHVzYUVycm9yfSBJZiBBUEkga2V5IGlzIG1pc3NpbmdcbiAgICovXG4gIHN0YXRpYyB2YWxpZGF0ZU9wdGlvbnMob3B0aW9uczogUHJvdmlkZXJPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKCFvcHRpb25zLmFwaUtleSB8fCAhb3B0aW9ucy5yZWRpcmVjdFVybCB8fCAhb3B0aW9ucy5tZWR1c2FVcmwpIHtcbiAgICAgIHRocm93IG5ldyBNZWR1c2FFcnJvcihcbiAgICAgICAgTWVkdXNhRXJyb3IuVHlwZXMuSU5WQUxJRF9EQVRBLFxuICAgICAgICBcIkFQSSBrZXksIHJlZGlyZWN0IFVSTCwgYW5kIE1lZHVzYSBVUkwgYXJlIHJlcXVpcmVkIGluIHRoZSBwcm92aWRlcidzIG9wdGlvbnMuXCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBNb2xsaWUgcGF5bWVudCBwcm92aWRlclxuICAgKiBAcGFyYW0gY29udGFpbmVyIC0gVGhlIGRlcGVuZGVuY3kgY29udGFpbmVyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEluamVjdGVkRGVwZW5kZW5jaWVzLCBvcHRpb25zOiBQcm92aWRlck9wdGlvbnMpIHtcbiAgICBzdXBlcihjb250YWluZXIsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5sb2dnZXJfID0gY29udGFpbmVyLmxvZ2dlcjtcbiAgICB0aGlzLm9wdGlvbnNfID0gb3B0aW9ucztcbiAgICB0aGlzLmRlYnVnXyA9XG4gICAgICBvcHRpb25zLmRlYnVnIHx8XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJkZXZlbG9wbWVudFwiIHx8XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJ0ZXN0XCIgfHxcbiAgICAgIGZhbHNlO1xuXG4gICAgdGhpcy5jbGllbnRfID0gY3JlYXRlTW9sbGllQ2xpZW50KHtcbiAgICAgIGFwaUtleTogb3B0aW9ucy5hcGlLZXksXG4gICAgICB2ZXJzaW9uU3RyaW5nczogW1xuICAgICAgICBcIk1lZHVzYUpTL1wiICsgcmVxdWlyZShcIkBtZWR1c2Fqcy9tZWR1c2EvcGFja2FnZS5qc29uXCIpLnZlcnNpb24sXG4gICAgICAgIFwiVmFyaWFibGVWaWMvXCIgKyBwcm9jZXNzLmVudi5ucG1fcGFja2FnZV92ZXJzaW9uLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIGFic3RyYWN0IGdldCBwYXltZW50Q3JlYXRlT3B0aW9ucygpOiBQYXltZW50T3B0aW9ucztcblxuICBub3JtYWxpemVQYXltZW50Q3JlYXRlUGFyYW1zKCk6IFBhcnRpYWw8UGF5bWVudENyZWF0ZVBhcmFtcz4ge1xuICAgIGNvbnN0IHJlcyA9IHt9IGFzIFBhcnRpYWw8UGF5bWVudENyZWF0ZVBhcmFtcz47XG5cbiAgICBpZiAodGhpcy5wYXltZW50Q3JlYXRlT3B0aW9ucy5tZXRob2QpIHtcbiAgICAgIHJlcy5tZXRob2QgPSB0aGlzLnBheW1lbnRDcmVhdGVPcHRpb25zLm1ldGhvZCBhcyBQYXltZW50TWV0aG9kO1xuICAgIH1cblxuICAgIHJlcy53ZWJob29rVXJsID0gdGhpcy5wYXltZW50Q3JlYXRlT3B0aW9ucy53ZWJob29rVXJsO1xuXG4gICAgcmVzLmNhcHR1cmVNb2RlID1cbiAgICAgIHRoaXMucGF5bWVudENyZWF0ZU9wdGlvbnMuY2FwdHVyZU1ldGhvZCA/P1xuICAgICAgKHRoaXMub3B0aW9uc18uYXV0b0NhcHR1cmUgIT09IGZhbHNlXG4gICAgICAgID8gQ2FwdHVyZU1ldGhvZC5hdXRvbWF0aWNcbiAgICAgICAgOiBDYXB0dXJlTWV0aG9kLm1hbnVhbCk7XG5cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlcyBhIG5ldyBwYXltZW50IHdpdGggTW9sbGllXG4gICAqIEBwYXJhbSBpbnB1dCAtIFRoZSBwYXltZW50IGluaXRpYXRpb24gaW5wdXRcbiAgICogQHJldHVybnMgVGhlIGluaXRpYXRlZCBwYXltZW50IGRldGFpbHNcbiAgICovXG4gIGFzeW5jIGluaXRpYXRlUGF5bWVudCh7XG4gICAgZGF0YSxcbiAgICBjb250ZXh0LFxuICAgIGFtb3VudCxcbiAgICBjdXJyZW5jeV9jb2RlLFxuICB9OiBJbml0aWF0ZVBheW1lbnRJbnB1dCk6IFByb21pc2U8SW5pdGlhdGVQYXltZW50T3V0cHV0PiB7XG4gICAgY29uc3Qgc2hpcHBpbmdUb3RhbCA9IGRhdGE/LnNoaXBwaW5nX3RvdGFsIGFzIG51bWJlcjtcblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRQYXJhbXMgPSB0aGlzLm5vcm1hbGl6ZVBheW1lbnRDcmVhdGVQYXJhbXMoKTtcblxuICAgIGNvbnN0IGJpbGxpbmcgPSAoZGF0YT8uYmlsbGluZ19hZGRyZXNzID8/XG4gICAgICBjb250ZXh0Py5jdXN0b21lcj8uYmlsbGluZ19hZGRyZXNzKSBhc1xuICAgICAgfCB7XG4gICAgICAgICAgYWRkcmVzc18xPzogc3RyaW5nO1xuICAgICAgICAgIHBvc3RhbF9jb2RlPzogc3RyaW5nO1xuICAgICAgICAgIGNpdHk/OiBzdHJpbmc7XG4gICAgICAgICAgY291bnRyeV9jb2RlPzogc3RyaW5nO1xuICAgICAgICAgIGZpcnN0X25hbWU/OiBzdHJpbmc7XG4gICAgICAgICAgbGFzdF9uYW1lPzogc3RyaW5nO1xuICAgICAgICB9XG4gICAgICB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBlbWFpbCA9IChkYXRhPy5lbWFpbCA/PyBjb250ZXh0Py5jdXN0b21lcj8uZW1haWwpIGFzXG4gICAgICB8IHN0cmluZ1xuICAgICAgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgbGluZXMgPSBbXG4gICAgICAuLi4oKGRhdGE/Lml0ZW1zID8/IFtdKSBhcyBhbnlbXSkubWFwKChpdGVtKSA9PiAoe1xuICAgICAgICB0eXBlOiBcInBoeXNpY2FsXCIgYXMgUGF5bWVudExpbmVUeXBlLFxuICAgICAgICBuYW1lOiBpdGVtLnRpdGxlIHx8IGl0ZW0udmFyaWFudD8ucHJvZHVjdD8udGl0bGUgfHwgXCJQcm9kdWN0XCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBpdGVtLnRpdGxlIHx8IGl0ZW0udmFyaWFudD8ucHJvZHVjdD8udGl0bGUgfHwgXCJQcm9kdWN0XCIsXG4gICAgICAgIHF1YW50aXR5OiBpdGVtLnF1YW50aXR5LFxuICAgICAgICB1bml0UHJpY2U6IHtcbiAgICAgICAgICBjdXJyZW5jeTogY3VycmVuY3lfY29kZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgIHZhbHVlOiBpdGVtLnVuaXRfcHJpY2UsXG4gICAgICAgIH0sXG4gICAgICAgIHRvdGFsQW1vdW50OiB7XG4gICAgICAgICAgY3VycmVuY3k6IGN1cnJlbmN5X2NvZGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICB2YWx1ZTogKGl0ZW0udW5pdF9wcmljZSAqIGl0ZW0ucXVhbnRpdHkpLnRvRml4ZWQoMiksXG4gICAgICAgIH0sXG4gICAgICAgIHZhdFJhdGU6IFwiMC4wMFwiLFxuICAgICAgICB2YXRBbW91bnQ6IHtcbiAgICAgICAgICBjdXJyZW5jeTogY3VycmVuY3lfY29kZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgIHZhbHVlOiBcIjAuMDBcIixcbiAgICAgICAgfSxcbiAgICAgIH0pKSxcbiAgICAgIC8vIE9ubHkgYXBwZW5kIHNoaXBwaW5nIGxpbmUgaWYgdGhlcmUncyBhIHNoaXBwaW5nIGNvc3RcbiAgICAgIC4uLihzaGlwcGluZ1RvdGFsID4gMFxuICAgICAgICA/IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdHlwZTogXCJzaGlwcGluZ19mZWVcIiBhcyBQYXltZW50TGluZVR5cGUsXG4gICAgICAgICAgICAgIG5hbWU6IFwiU2hpcHBpbmdcIixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiU2hpcHBpbmdcIixcbiAgICAgICAgICAgICAgcXVhbnRpdHk6IDEsXG4gICAgICAgICAgICAgIHVuaXRQcmljZToge1xuICAgICAgICAgICAgICAgIGN1cnJlbmN5OiBjdXJyZW5jeV9jb2RlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgdmFsdWU6IHNoaXBwaW5nVG90YWwudG9GaXhlZCgyKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgdG90YWxBbW91bnQ6IHtcbiAgICAgICAgICAgICAgICBjdXJyZW5jeTogY3VycmVuY3lfY29kZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBzaGlwcGluZ1RvdGFsLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHZhdFJhdGU6IFwiMC4wMFwiLFxuICAgICAgICAgICAgICB2YXRBbW91bnQ6IHtcbiAgICAgICAgICAgICAgICBjdXJyZW5jeTogY3VycmVuY3lfY29kZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBcIjAuMDBcIixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXVxuICAgICAgICA6IFtdKSxcbiAgICBdO1xuXG4gICAgY29uc29sZS5kaXIobGluZXMsIHsgZGVwdGg6IG51bGwgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY3JlYXRlUGFyYW1zOiBQYXltZW50Q3JlYXRlUGFyYW1zID0ge1xuICAgICAgICAuLi5ub3JtYWxpemVkUGFyYW1zLFxuXG4gICAgICAgIGJpbGxpbmdBZGRyZXNzOiB7XG4gICAgICAgICAgc3RyZWV0QW5kTnVtYmVyOiBiaWxsaW5nPy5hZGRyZXNzXzEgfHwgXCJcIixcbiAgICAgICAgICBnaXZlbk5hbWU6IGJpbGxpbmc/LmZpcnN0X25hbWUgfHwgXCJcIixcbiAgICAgICAgICBmYW1pbHlOYW1lOiBiaWxsaW5nPy5sYXN0X25hbWUgfHwgXCJcIixcbiAgICAgICAgICBlbWFpbCxcbiAgICAgICAgICBwb3N0YWxDb2RlOiBiaWxsaW5nPy5wb3N0YWxfY29kZSB8fCBcIlwiLFxuICAgICAgICAgIGNpdHk6IGJpbGxpbmc/LmNpdHkgfHwgXCJcIixcbiAgICAgICAgICBjb3VudHJ5OiBiaWxsaW5nPy5jb3VudHJ5X2NvZGUgfHwgXCJcIixcbiAgICAgICAgfSxcbiAgICAgICAgYmlsbGluZ0VtYWlsOiBlbWFpbCB8fCBcIlwiLFxuICAgICAgICBsaW5lcyxcbiAgICAgICAgYW1vdW50OiB7XG4gICAgICAgICAgdmFsdWU6IHBhcnNlRmxvYXQoYW1vdW50LnRvU3RyaW5nKCkpLnRvRml4ZWQoMiksXG4gICAgICAgICAgY3VycmVuY3k6IGN1cnJlbmN5X2NvZGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICAgdGhpcy5vcHRpb25zXy5kZXNjcmlwdGlvbiB8fCBcIk1vbGxpZSBwYXltZW50IGNyZWF0ZWQgYnkgTWVkdXNhXCIsXG4gICAgICAgIHJlZGlyZWN0VXJsOiB0aGlzLm9wdGlvbnNfLnJlZGlyZWN0VXJsLFxuICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgIGlkZW1wb3RlbmN5X2tleTogY29udGV4dD8uaWRlbXBvdGVuY3lfa2V5LFxuICAgICAgICB9LFxuICAgICAgfTtcblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50Xy5wYXltZW50c1xuICAgICAgICAuY3JlYXRlKGNyZWF0ZVBhcmFtcylcbiAgICAgICAgLnRoZW4oKHBheW1lbnQpID0+IHtcbiAgICAgICAgICByZXR1cm4gcGF5bWVudCBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5sb2dnZXJfLmVycm9yKFxuICAgICAgICAgICAgYE1vbGxpZSBwYXltZW50IGNyZWF0aW9uIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aHJvdyBuZXcgTWVkdXNhRXJyb3IoTWVkdXNhRXJyb3IuVHlwZXMuSU5WQUxJRF9EQVRBLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZGVidWdfICYmXG4gICAgICAgIHRoaXMubG9nZ2VyXy5pbmZvKFxuICAgICAgICAgIGBNb2xsaWUgcGF5bWVudCAke2RhdGEuaWR9IHN1Y2Nlc3NmdWxseSBjcmVhdGVkIHdpdGggYW1vdW50ICR7YW1vdW50fWAsXG4gICAgICAgICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiBkYXRhLmlkLFxuICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXJfLmVycm9yKGBFcnJvciBpbml0aWF0aW5nIE1vbGxpZSBwYXltZW50OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgcGF5bWVudCBpcyBhdXRob3JpemVkIHdpdGggTW9sbGllXG4gICAqIEBwYXJhbSBpbnB1dCAtIFRoZSBwYXltZW50IGF1dGhvcml6YXRpb24gaW5wdXRcbiAgICogQHJldHVybnMgVGhlIGF1dGhvcml6YXRpb24gcmVzdWx0XG4gICAqL1xuICBhc3luYyBhdXRob3JpemVQYXltZW50KFxuICAgIGlucHV0OiBBdXRob3JpemVQYXltZW50SW5wdXQsXG4gICk6IFByb21pc2U8QXV0aG9yaXplUGF5bWVudE91dHB1dD4ge1xuICAgIGNvbnN0IGV4dGVybmFsSWQgPSBpbnB1dC5kYXRhPy5pZDtcblxuICAgIGlmICghZXh0ZXJuYWxJZCkge1xuICAgICAgdGhyb3cgbmV3IE1lZHVzYUVycm9yKFxuICAgICAgICBNZWR1c2FFcnJvci5UeXBlcy5JTlZBTElEX0RBVEEsXG4gICAgICAgIFwiUGF5bWVudCBJRCBpcyByZXF1aXJlZFwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBzdGF0dXMgfSA9IGF3YWl0IHRoaXMuZ2V0UGF5bWVudFN0YXR1cyh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpZDogZXh0ZXJuYWxJZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIVtcImNhcHR1cmVkXCIsIFwiYXV0aG9yaXplZFwiLCBcInBhaWRcIl0uaW5jbHVkZXMoc3RhdHVzKSkge1xuICAgICAgICB0aHJvdyBuZXcgTWVkdXNhRXJyb3IoXG4gICAgICAgICAgTWVkdXNhRXJyb3IuVHlwZXMuSU5WQUxJRF9EQVRBLFxuICAgICAgICAgIGBQYXltZW50IGlzIG5vdCBhdXRob3JpemVkOiBjdXJyZW50IHN0YXR1cyBpcyAke3N0YXR1c31gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlYnVnXyAmJlxuICAgICAgICB0aGlzLmxvZ2dlcl8uaW5mbyhcbiAgICAgICAgICBgTW9sbGllIHBheW1lbnQgJHtleHRlcm5hbElkfSBzdWNjZXNzZnVsbHkgYXV0aG9yaXplZCB3aXRoIHN0YXR1cyAke3N0YXR1c31gLFxuICAgICAgICApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRhOiBpbnB1dC5kYXRhLFxuICAgICAgICBzdGF0dXMsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlcl8uZXJyb3IoXG4gICAgICAgIGBFcnJvciBhdXRob3JpemluZyBwYXltZW50ICR7ZXh0ZXJuYWxJZH06ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYXB0dXJlcyBhbiBhdXRob3JpemVkIHBheW1lbnQgaWYgYXV0b0NhcHR1cmUgaXMgZGlzYWJsZWRcbiAgICogQHBhcmFtIGlucHV0IC0gVGhlIHBheW1lbnQgY2FwdHVyZSBpbnB1dFxuICAgKiBAcmV0dXJucyBUaGUgY2FwdHVyZSByZXN1bHRcbiAgICovXG4gIGFzeW5jIGNhcHR1cmVQYXltZW50KFxuICAgIGlucHV0OiBDYXB0dXJlUGF5bWVudElucHV0LFxuICApOiBQcm9taXNlPENhcHR1cmVQYXltZW50T3V0cHV0PiB7XG4gICAgY29uc3QgZXh0ZXJuYWxJZCA9IGlucHV0LmRhdGE/LmlkIGFzIHN0cmluZztcblxuICAgIGlmICghZXh0ZXJuYWxJZCkge1xuICAgICAgdGhyb3cgbmV3IE1lZHVzYUVycm9yKFxuICAgICAgICBNZWR1c2FFcnJvci5UeXBlcy5JTlZBTElEX0RBVEEsXG4gICAgICAgIFwiUGF5bWVudCBJRCBpcyByZXF1aXJlZFwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgbGV0IHN0YXR1czogUGF5bWVudFNlc3Npb25TdGF0dXMgfCBQYXltZW50U3RhdHVzO1xuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZXRyaWV2ZVBheW1lbnQoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgaWQ6IGV4dGVybmFsSWQsXG4gICAgICAgIH0sXG4gICAgICB9KS50aGVuKCh7IGRhdGEgfSkgPT4gZGF0YSBhcyB1bmtub3duIGFzIFBheW1lbnREYXRhKTtcblxuICAgICAgc3RhdHVzID0gZGF0YT8uc3RhdHVzIGFzIFBheW1lbnRTdGF0dXM7XG4gICAgICBjb25zdCBjYXB0dXJlTW9kZSA9IGRhdGE/LmNhcHR1cmVNb2RlIGFzIENhcHR1cmVNZXRob2Q7XG5cbiAgICAgIGlmIChcbiAgICAgICAgc3RhdHVzID09PSBQYXltZW50U3RhdHVzLmF1dGhvcml6ZWQgJiZcbiAgICAgICAgY2FwdHVyZU1vZGUgPT09IENhcHR1cmVNZXRob2QubWFudWFsXG4gICAgICApIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jbGllbnRfLnBheW1lbnRDYXB0dXJlcy5jcmVhdGUoe1xuICAgICAgICAgIHBheW1lbnRJZDogZXh0ZXJuYWxJZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHN0YXR1cyA9IGF3YWl0IHRoaXMuZ2V0UGF5bWVudFN0YXR1cyh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpZDogZXh0ZXJuYWxJZCxcbiAgICAgICAgfSxcbiAgICAgIH0pLnRoZW4oKHJlcykgPT4gcmVzLnN0YXR1cyBhcyBQYXltZW50U2Vzc2lvblN0YXR1cyk7XG5cbiAgICAgIGlmIChzdGF0dXMgIT09IFBheW1lbnRTZXNzaW9uU3RhdHVzLkNBUFRVUkVEKSB7XG4gICAgICAgIHRocm93IG5ldyBNZWR1c2FFcnJvcihcbiAgICAgICAgICBNZWR1c2FFcnJvci5UeXBlcy5JTlZBTElEX0RBVEEsXG4gICAgICAgICAgYFBheW1lbnQgaXMgbm90IGNhcHR1cmVkOiBjdXJyZW50IHN0YXR1cyBpcyAke3N0YXR1c31gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlYnVnXyAmJlxuICAgICAgICB0aGlzLmxvZ2dlcl8uaW5mbyhcbiAgICAgICAgICBgTW9sbGllIHBheW1lbnQgJHtleHRlcm5hbElkfSBjYXB0dXJlZCB3aXRoIGFtb3VudCAke1xuICAgICAgICAgICAgKGlucHV0LmRhdGE/LmFtb3VudCBhcyBCaWdOdW1iZXJSYXdWYWx1ZSkuY3VycmVuY3lfY29kZVxuICAgICAgICAgIH0gJHsoaW5wdXQuZGF0YT8uYW1vdW50IGFzIEJpZ051bWJlclJhd1ZhbHVlKS52YWx1ZX1gLFxuICAgICAgICApO1xuXG4gICAgICBjb25zdCBwYXltZW50ID0gYXdhaXQgdGhpcy5yZXRyaWV2ZVBheW1lbnQoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgaWQ6IGV4dGVybmFsSWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGF0YTogcGF5bWVudC5kYXRhLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXJfLmVycm9yKFxuICAgICAgICBgRXJyb3IgY2FwdHVyaW5nIHBheW1lbnQgJHtleHRlcm5hbElkfTogJHtlcnJvci5tZXNzYWdlfWAsXG4gICAgICApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZnVuZHMgYSBwYXltZW50XG4gICAqIEBwYXJhbSBpbnB1dCAtIFRoZSBwYXltZW50IHJlZnVuZCBpbnB1dFxuICAgKiBAcmV0dXJucyBUaGUgcmVmdW5kIHJlc3VsdFxuICAgKi9cbiAgYXN5bmMgcmVmdW5kUGF5bWVudChpbnB1dDogUmVmdW5kUGF5bWVudElucHV0KTogUHJvbWlzZTxSZWZ1bmRQYXltZW50T3V0cHV0PiB7XG4gICAgY29uc3QgZXh0ZXJuYWxJZCA9IGlucHV0LmRhdGE/LmlkIGFzIHN0cmluZztcblxuICAgIGlmICghZXh0ZXJuYWxJZCkge1xuICAgICAgdGhyb3cgbmV3IE1lZHVzYUVycm9yKFxuICAgICAgICBNZWR1c2FFcnJvci5UeXBlcy5JTlZBTElEX0RBVEEsXG4gICAgICAgIFwiUGF5bWVudCBJRCBpcyByZXF1aXJlZFwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHRoaXMucmV0cmlldmVQYXltZW50KHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGlkOiBleHRlcm5hbElkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gKGlucHV0LmRhdGE/LmFtb3VudCBhcyBCaWdOdW1iZXJSYXdWYWx1ZSkudmFsdWU7XG4gICAgICBjb25zdCBjdXJyZW5jeTogc3RyaW5nID0gKHBheW1lbnQuZGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KT8uYW1vdW50XG4gICAgICAgID8uY3VycmVuY3kgYXMgc3RyaW5nO1xuXG4gICAgICBpZiAoIWN1cnJlbmN5KSB7XG4gICAgICAgIHRocm93IG5ldyBNZWR1c2FFcnJvcihcbiAgICAgICAgICBNZWR1c2FFcnJvci5UeXBlcy5JTlZBTElEX0RBVEEsXG4gICAgICAgICAgXCJDdXJyZW5jeSBpbmZvcm1hdGlvbiBpcyBtaXNzaW5nIGZyb20gcGF5bWVudCBkYXRhXCIsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlZnVuZCA9IGF3YWl0IHRoaXMuY2xpZW50Xy5wYXltZW50UmVmdW5kcy5jcmVhdGUoe1xuICAgICAgICBwYXltZW50SWQ6IGV4dGVybmFsSWQsXG4gICAgICAgIGFtb3VudDoge1xuICAgICAgICAgIHZhbHVlOiBwYXJzZUZsb2F0KHZhbHVlLnRvU3RyaW5nKCkpLnRvRml4ZWQoMiksXG4gICAgICAgICAgY3VycmVuY3k6IGN1cnJlbmN5LnRvVXBwZXJDYXNlKCksXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5kZWJ1Z18gJiZcbiAgICAgICAgdGhpcy5sb2dnZXJfLmluZm8oXG4gICAgICAgICAgYFJlZnVuZCBmb3IgTW9sbGllIHBheW1lbnQgJHtleHRlcm5hbElkfSBjcmVhdGVkIHdpdGggYW1vdW50ICR7Y3VycmVuY3kudG9VcHBlckNhc2UoKX0gJHtwYXJzZUZsb2F0KFxuICAgICAgICAgICAgdmFsdWUudG9TdHJpbmcoKSxcbiAgICAgICAgICApLnRvRml4ZWQoMil9YCxcbiAgICAgICAgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGF0YTogeyAuLi5yZWZ1bmQgfSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyXy5lcnJvcihcbiAgICAgICAgYEVycm9yIHJlZnVuZGluZyBwYXltZW50ICR7ZXh0ZXJuYWxJZH06ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYW5jZWxzIGEgcGF5bWVudFxuICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgcGF5bWVudCBjYW5jZWxsYXRpb24gaW5wdXRcbiAgICogQHJldHVybnMgVGhlIGNhbmNlbGxhdGlvbiByZXN1bHRcbiAgICovXG4gIGFzeW5jIGNhbmNlbFBheW1lbnQoaW5wdXQ6IENhbmNlbFBheW1lbnRJbnB1dCk6IFByb21pc2U8Q2FuY2VsUGF5bWVudE91dHB1dD4ge1xuICAgIGNvbnN0IHsgaWQgfSA9IGlucHV0LmRhdGEgYXMgUmVjb3JkPHN0cmluZywgYW55PjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXltZW50ID0gYXdhaXQgdGhpcy5jbGllbnRfLnBheW1lbnRzLmdldChpZCk7XG5cbiAgICAgIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5leHBpcmVkKSB7XG4gICAgICAgIHRoaXMuZGVidWdfICYmXG4gICAgICAgICAgdGhpcy5sb2dnZXJfLmluZm8oXG4gICAgICAgICAgICBgTW9sbGllIHBheW1lbnQgJHtpZH0gaXMgYWxyZWFkeSBleHBpcmVkLCBubyBuZWVkIHRvIGNhbmNlbGAsXG4gICAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBpZDogaW5wdXQuZGF0YT8uaWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3UGF5bWVudCA9IGF3YWl0IHRoaXMuY2xpZW50Xy5wYXltZW50c1xuICAgICAgICAuY2FuY2VsKGlkKVxuICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5sb2dnZXJfLndhcm4oXG4gICAgICAgICAgICBgQ291bGQgbm90IGNhbmNlbCBNb2xsaWUgcGF5bWVudCAke2lkfTogJHtlcnJvci5tZXNzYWdlfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4geyBkYXRhOiBwYXltZW50IGFzIFJlY29yZDxzdHJpbmcsIGFueT4gfTtcbiAgICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZGVidWdfICYmXG4gICAgICAgIHRoaXMubG9nZ2VyXy5pbmZvKGBNb2xsaWUgcGF5bWVudCAke2lkfSBjYW5jZWxsZWQgc3VjY2Vzc2Z1bGx5YCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IG5ld1BheW1lbnQgYXMgUmVjb3JkPHN0cmluZywgYW55PixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyXy5lcnJvcihgRXJyb3IgY2FuY2VsbGluZyBwYXltZW50ICR7aWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBhIHBheW1lbnQgKGVxdWl2YWxlbnQgdG8gY2FuY2VsbGF0aW9uIGFzIE1vbGxpZSBkb2VzIG5vdCBzdXBwb3J0IGRlbGV0aW9uKVxuICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgcGF5bWVudCBkZWxldGlvbiBpbnB1dFxuICAgKiBAcmV0dXJucyBUaGUgZGVsZXRpb24gcmVzdWx0XG4gICAqL1xuICBhc3luYyBkZWxldGVQYXltZW50KGlucHV0OiBEZWxldGVQYXltZW50SW5wdXQpOiBQcm9taXNlPERlbGV0ZVBheW1lbnRPdXRwdXQ+IHtcbiAgICByZXR1cm4gdGhpcy5jYW5jZWxQYXltZW50KGlucHV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBzdGF0dXMgb2YgYSBwYXltZW50IGJ5IG1hcHBpbmcgTW9sbGllIHN0YXR1c2VzIHRvIE1lZHVzYSBzdGF0dXNlc1xuICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgcGF5bWVudCBzdGF0dXMgaW5wdXRcbiAgICogQHJldHVybnMgVGhlIHBheW1lbnQgc3RhdHVzXG4gICAqL1xuICBhc3luYyBnZXRQYXltZW50U3RhdHVzKFxuICAgIGlucHV0OiBHZXRQYXltZW50U3RhdHVzSW5wdXQsXG4gICk6IFByb21pc2U8R2V0UGF5bWVudFN0YXR1c091dHB1dD4ge1xuICAgIGNvbnN0IHBheW1lbnRJZCA9IGlucHV0LmRhdGE/LmlkIGFzIHN0cmluZztcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHN0YXR1cyB9ID0gYXdhaXQgdGhpcy5jbGllbnRfLnBheW1lbnRzLmdldChwYXltZW50SWQpO1xuXG4gICAgICBjb25zdCBzdGF0dXNNYXAgPSB7XG4gICAgICAgIFtQYXltZW50U3RhdHVzLm9wZW5dOiBQYXltZW50U2Vzc2lvblN0YXR1cy5SRVFVSVJFU19NT1JFLFxuICAgICAgICBbUGF5bWVudFN0YXR1cy5jYW5jZWxlZF06IFBheW1lbnRTZXNzaW9uU3RhdHVzLkNBTkNFTEVELFxuICAgICAgICBbUGF5bWVudFN0YXR1cy5wZW5kaW5nXTogUGF5bWVudFNlc3Npb25TdGF0dXMuUEVORElORyxcbiAgICAgICAgW1BheW1lbnRTdGF0dXMuYXV0aG9yaXplZF06IFBheW1lbnRTZXNzaW9uU3RhdHVzLkFVVEhPUklaRUQsXG4gICAgICAgIFtQYXltZW50U3RhdHVzLmV4cGlyZWRdOiBQYXltZW50U2Vzc2lvblN0YXR1cy5FUlJPUixcbiAgICAgICAgW1BheW1lbnRTdGF0dXMuZmFpbGVkXTogUGF5bWVudFNlc3Npb25TdGF0dXMuRVJST1IsXG4gICAgICAgIFtQYXltZW50U3RhdHVzLnBhaWRdOiBQYXltZW50U2Vzc2lvblN0YXR1cy5DQVBUVVJFRCxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG1hcHBlZFN0YXR1cyA9IHN0YXR1c01hcFtzdGF0dXNdIGFzIFBheW1lbnRTZXNzaW9uU3RhdHVzO1xuXG4gICAgICB0aGlzLmRlYnVnXyAmJlxuICAgICAgICB0aGlzLmxvZ2dlcl8uZGVidWcoXG4gICAgICAgICAgYE1vbGxpZSBwYXltZW50ICR7cGF5bWVudElkfSBzdGF0dXM6ICR7c3RhdHVzfSAobWFwcGVkIHRvOiAke21hcHBlZFN0YXR1c30pYCxcbiAgICAgICAgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiBtYXBwZWRTdGF0dXMsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlcl8uZXJyb3IoXG4gICAgICAgIGBFcnJvciByZXRyaWV2aW5nIHBheW1lbnQgc3RhdHVzIGZvciAke3BheW1lbnRJZH06ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgcGF5bWVudCBkZXRhaWxzXG4gICAqIEBwYXJhbSBpbnB1dCAtIFRoZSBwYXltZW50IHJldHJpZXZhbCBpbnB1dFxuICAgKiBAcmV0dXJucyBUaGUgcGF5bWVudCBkZXRhaWxzXG4gICAqL1xuICBhc3luYyByZXRyaWV2ZVBheW1lbnQoXG4gICAgaW5wdXQ6IFJldHJpZXZlUGF5bWVudElucHV0LFxuICApOiBQcm9taXNlPFJldHJpZXZlUGF5bWVudE91dHB1dD4ge1xuICAgIGNvbnN0IHBheW1lbnRJZCA9IGlucHV0LmRhdGE/LmlkIGFzIHN0cmluZztcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnRfLnBheW1lbnRzLmdldChwYXltZW50SWQpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGF0YTogZGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXJfLmVycm9yKFxuICAgICAgICBgRXJyb3IgcmV0cmlldmluZyBNb2xsaWUgcGF5bWVudCAke3BheW1lbnRJZH06ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIGEgcGF5bWVudFxuICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgcGF5bWVudCB1cGRhdGUgaW5wdXRcbiAgICogQHJldHVybnMgVGhlIHVwZGF0ZWQgcGF5bWVudCBkZXRhaWxzXG4gICAqL1xuICBhc3luYyB1cGRhdGVQYXltZW50KGlucHV0OiBVcGRhdGVQYXltZW50SW5wdXQpOiBQcm9taXNlPFVwZGF0ZVBheW1lbnRPdXRwdXQ+IHtcbiAgICB0aGlzLmRlYnVnXyAmJlxuICAgICAgdGhpcy5sb2dnZXJfLmluZm8oXG4gICAgICAgIFwiTm90ZTogTW9sbGllIGRvZXMgbm90IGFsbG93IHVwZGF0aW5nIGFtb3VudHMgb24gYW4gZXhpc3RpbmcgcGF5bWVudC4gXFxuXCIgK1xuICAgICAgICAgIFwiQ2hlY2sgaHR0cHM6Ly9kb2NzLm1vbGxpZS5jb20vcmVmZXJlbmNlL3VwZGF0ZS1wYXltZW50IGZvciBhbGxvd2VkIHVwZGF0ZXMuXCIsXG4gICAgICApO1xuXG4gICAgY29uc3Qge1xuICAgICAgaWQsXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICAgIHJlZGlyZWN0VXJsLFxuICAgICAgY2FuY2VsVXJsLFxuICAgICAgd2ViaG9va1VybCxcbiAgICAgIG1ldGFkYXRhLFxuICAgICAgcmVzdHJpY3RQYXltZW50TWV0aG9kc1RvQ291bnRyeSxcbiAgICB9ID0gaW5wdXQuZGF0YSBhcyBVcGRhdGVQYXJhbWV0ZXJzICYge1xuICAgICAgaWQ6IHN0cmluZztcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudF8ucGF5bWVudHMudXBkYXRlKGlkLCB7XG4gICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICByZWRpcmVjdFVybCxcbiAgICAgICAgY2FuY2VsVXJsLFxuICAgICAgICB3ZWJob29rVXJsLFxuICAgICAgICBtZXRhZGF0YSxcbiAgICAgICAgcmVzdHJpY3RQYXltZW50TWV0aG9kc1RvQ291bnRyeSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmRlYnVnXyAmJlxuICAgICAgICB0aGlzLmxvZ2dlcl8uaW5mbyhgTW9sbGllIHBheW1lbnQgJHtpZH0gc3VjY2Vzc2Z1bGx5IHVwZGF0ZWRgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGF0YTogZGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXJfLmVycm9yKFxuICAgICAgICBgRXJyb3IgdXBkYXRpbmcgTW9sbGllIHBheW1lbnQgJHtpZH06ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgd2ViaG9vayBkYXRhIGZyb20gTW9sbGllXG4gICAqIEBwYXJhbSBwYXlsb2FkIC0gVGhlIHdlYmhvb2sgcGF5bG9hZFxuICAgKiBAcmV0dXJucyBUaGUgYWN0aW9uIGFuZCBkYXRhIHRvIGJlIHByb2Nlc3NlZFxuICAgKi9cbiAgYXN5bmMgZ2V0V2ViaG9va0FjdGlvbkFuZERhdGEoXG4gICAgcGF5bG9hZDogUHJvdmlkZXJXZWJob29rUGF5bG9hZFtcInBheWxvYWRcIl0sXG4gICk6IFByb21pc2U8V2ViaG9va0FjdGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IHsgZGF0YSB9ID0gcGF5bG9hZDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGRhdGE6IHBheW1lbnQgfSA9IGF3YWl0IHRoaXMucmV0cmlldmVQYXltZW50KHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGlkOiBkYXRhLmlkLFxuICAgICAgICB9LFxuICAgICAgfSkuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgdGhyb3cgbmV3IE1lZHVzYUVycm9yKE1lZHVzYUVycm9yLlR5cGVzLk5PVF9GT1VORCwgZS5tZXNzYWdlKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXBheW1lbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1lZHVzYUVycm9yKE1lZHVzYUVycm9yLlR5cGVzLk5PVF9GT1VORCwgXCJQYXltZW50IG5vdCBmb3VuZFwiKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RhdHVzID0gcGF5bWVudD8uc3RhdHVzIGFzIFBheW1lbnRTdGF0dXM7XG4gICAgICBjb25zdCBzZXNzaW9uX2lkID0gKHBheW1lbnQ/Lm1ldGFkYXRhIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pXG4gICAgICAgID8uaWRlbXBvdGVuY3lfa2V5O1xuICAgICAgY29uc3QgYW1vdW50ID0gbmV3IEJpZ051bWJlcihwYXltZW50Py5hbW91bnQgYXMgbnVtYmVyKTtcblxuICAgICAgY29uc3QgYmFzZURhdGEgPSB7XG4gICAgICAgIGFtb3VudCxcbiAgICAgICAgc2Vzc2lvbl9pZCxcbiAgICAgICAgLi4ucGF5bWVudCxcbiAgICAgIH07XG5cbiAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICAgIGNhc2UgUGF5bWVudFN0YXR1cy5hdXRob3JpemVkOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3Rpb246IFBheW1lbnRBY3Rpb25zLkFVVEhPUklaRUQsXG4gICAgICAgICAgICBkYXRhOiBiYXNlRGF0YSxcbiAgICAgICAgICB9O1xuICAgICAgICBjYXNlIFBheW1lbnRTdGF0dXMucGFpZDpcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aW9uOiBQYXltZW50QWN0aW9ucy5TVUNDRVNTRlVMLFxuICAgICAgICAgICAgZGF0YTogYmFzZURhdGEsXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBQYXltZW50U3RhdHVzLmV4cGlyZWQ6XG4gICAgICAgIGNhc2UgUGF5bWVudFN0YXR1cy5mYWlsZWQ6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFjdGlvbjogUGF5bWVudEFjdGlvbnMuRkFJTEVELFxuICAgICAgICAgICAgZGF0YTogYmFzZURhdGEsXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBQYXltZW50U3RhdHVzLmNhbmNlbGVkOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3Rpb246IFBheW1lbnRBY3Rpb25zLkNBTkNFTEVELFxuICAgICAgICAgICAgZGF0YTogYmFzZURhdGEsXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBQYXltZW50U3RhdHVzLnBlbmRpbmc6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFjdGlvbjogUGF5bWVudEFjdGlvbnMuUEVORElORyxcbiAgICAgICAgICAgIGRhdGE6IGJhc2VEYXRhLFxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgUGF5bWVudFN0YXR1cy5vcGVuOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3Rpb246IFBheW1lbnRBY3Rpb25zLlJFUVVJUkVTX01PUkUsXG4gICAgICAgICAgICBkYXRhOiBiYXNlRGF0YSxcbiAgICAgICAgICB9O1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3Rpb246IFBheW1lbnRBY3Rpb25zLk5PVF9TVVBQT1JURUQsXG4gICAgICAgICAgICBkYXRhOiBiYXNlRGF0YSxcbiAgICAgICAgICB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlcl8uZXJyb3IoXG4gICAgICAgIGBFcnJvciBwcm9jZXNzaW5nIHdlYmhvb2sgZm9yIHBheW1lbnQgJHtkYXRhLmlkfTogJHtlcnJvci5tZXNzYWdlfWAsXG4gICAgICApO1xuXG4gICAgICAvLyBFdmVuIHdpdGggZXJyb3JzLCB0cnkgdG8gY29uc3RydWN0IGEgdmFsaWQgcmVzcG9uc2UgaWYgd2UgaGF2ZSB0aGUgcGF5bWVudFxuICAgICAgY29uc3QgeyBkYXRhOiBwYXltZW50IH0gPSBhd2FpdCB0aGlzLnJldHJpZXZlUGF5bWVudCh7XG4gICAgICAgIGRhdGE6IHsgaWQ6IGRhdGEuaWQgfSxcbiAgICAgIH0pLmNhdGNoKCgpID0+ICh7IGRhdGE6IG51bGwgfSkpO1xuXG4gICAgICBpZiAocGF5bWVudCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGFjdGlvbjogXCJmYWlsZWRcIixcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBzZXNzaW9uX2lkOiAocGF5bWVudD8ubWV0YWRhdGEgYXMgUmVjb3JkPHN0cmluZywgYW55Pik/LnNlc3Npb25faWQsXG4gICAgICAgICAgICBhbW91bnQ6IG5ldyBCaWdOdW1iZXIocGF5bWVudD8uYW1vdW50IGFzIG51bWJlciksXG4gICAgICAgICAgICAuLi5wYXltZW50LFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb2xsaWVCYXNlO1xuIl0sIm5hbWVzIjpbIk1vbGxpZUJhc2UiLCJBYnN0cmFjdFBheW1lbnRQcm92aWRlciIsInZhbGlkYXRlT3B0aW9ucyIsIm9wdGlvbnMiLCJhcGlLZXkiLCJyZWRpcmVjdFVybCIsIm1lZHVzYVVybCIsIk1lZHVzYUVycm9yIiwiVHlwZXMiLCJJTlZBTElEX0RBVEEiLCJub3JtYWxpemVQYXltZW50Q3JlYXRlUGFyYW1zIiwicmVzIiwicGF5bWVudENyZWF0ZU9wdGlvbnMiLCJtZXRob2QiLCJ3ZWJob29rVXJsIiwiY2FwdHVyZU1vZGUiLCJjYXB0dXJlTWV0aG9kIiwib3B0aW9uc18iLCJhdXRvQ2FwdHVyZSIsIkNhcHR1cmVNZXRob2QiLCJhdXRvbWF0aWMiLCJtYW51YWwiLCJpbml0aWF0ZVBheW1lbnQiLCJkYXRhIiwiY29udGV4dCIsImFtb3VudCIsImN1cnJlbmN5X2NvZGUiLCJzaGlwcGluZ1RvdGFsIiwic2hpcHBpbmdfdG90YWwiLCJub3JtYWxpemVkUGFyYW1zIiwiYmlsbGluZyIsImJpbGxpbmdfYWRkcmVzcyIsImN1c3RvbWVyIiwiZW1haWwiLCJsaW5lcyIsIml0ZW1zIiwibWFwIiwiaXRlbSIsInR5cGUiLCJuYW1lIiwidGl0bGUiLCJ2YXJpYW50IiwicHJvZHVjdCIsImRlc2NyaXB0aW9uIiwicXVhbnRpdHkiLCJ1bml0UHJpY2UiLCJjdXJyZW5jeSIsInRvVXBwZXJDYXNlIiwidmFsdWUiLCJ1bml0X3ByaWNlIiwidG90YWxBbW91bnQiLCJ0b0ZpeGVkIiwidmF0UmF0ZSIsInZhdEFtb3VudCIsImNvbnNvbGUiLCJkaXIiLCJkZXB0aCIsImNyZWF0ZVBhcmFtcyIsImJpbGxpbmdBZGRyZXNzIiwic3RyZWV0QW5kTnVtYmVyIiwiYWRkcmVzc18xIiwiZ2l2ZW5OYW1lIiwiZmlyc3RfbmFtZSIsImZhbWlseU5hbWUiLCJsYXN0X25hbWUiLCJwb3N0YWxDb2RlIiwicG9zdGFsX2NvZGUiLCJjaXR5IiwiY291bnRyeSIsImNvdW50cnlfY29kZSIsImJpbGxpbmdFbWFpbCIsInBhcnNlRmxvYXQiLCJ0b1N0cmluZyIsIm1ldGFkYXRhIiwiaWRlbXBvdGVuY3lfa2V5IiwiY2xpZW50XyIsInBheW1lbnRzIiwiY3JlYXRlIiwidGhlbiIsInBheW1lbnQiLCJjYXRjaCIsImVycm9yIiwibG9nZ2VyXyIsIm1lc3NhZ2UiLCJkZWJ1Z18iLCJpbmZvIiwiaWQiLCJhdXRob3JpemVQYXltZW50IiwiaW5wdXQiLCJleHRlcm5hbElkIiwic3RhdHVzIiwiZ2V0UGF5bWVudFN0YXR1cyIsImluY2x1ZGVzIiwiY2FwdHVyZVBheW1lbnQiLCJyZXRyaWV2ZVBheW1lbnQiLCJQYXltZW50U3RhdHVzIiwiYXV0aG9yaXplZCIsInBheW1lbnRDYXB0dXJlcyIsInBheW1lbnRJZCIsIlBheW1lbnRTZXNzaW9uU3RhdHVzIiwiQ0FQVFVSRUQiLCJyZWZ1bmRQYXltZW50IiwicmVmdW5kIiwicGF5bWVudFJlZnVuZHMiLCJjYW5jZWxQYXltZW50IiwiZ2V0IiwiZXhwaXJlZCIsIm5ld1BheW1lbnQiLCJjYW5jZWwiLCJ3YXJuIiwiZGVsZXRlUGF5bWVudCIsInN0YXR1c01hcCIsIm9wZW4iLCJSRVFVSVJFU19NT1JFIiwiY2FuY2VsZWQiLCJDQU5DRUxFRCIsInBlbmRpbmciLCJQRU5ESU5HIiwiQVVUSE9SSVpFRCIsIkVSUk9SIiwiZmFpbGVkIiwicGFpZCIsIm1hcHBlZFN0YXR1cyIsImRlYnVnIiwidXBkYXRlUGF5bWVudCIsImNhbmNlbFVybCIsInJlc3RyaWN0UGF5bWVudE1ldGhvZHNUb0NvdW50cnkiLCJ1cGRhdGUiLCJnZXRXZWJob29rQWN0aW9uQW5kRGF0YSIsInBheWxvYWQiLCJlIiwiTk9UX0ZPVU5EIiwic2Vzc2lvbl9pZCIsIkJpZ051bWJlciIsImJhc2VEYXRhIiwiYWN0aW9uIiwiUGF5bWVudEFjdGlvbnMiLCJTVUNDRVNTRlVMIiwiRkFJTEVEIiwiTk9UX1NVUFBPUlRFRCIsImNvbnN0cnVjdG9yIiwiY29udGFpbmVyIiwibG9nZ2VyIiwicHJvY2VzcyIsImVudiIsIk5PREVfRU5WIiwiY3JlYXRlTW9sbGllQ2xpZW50IiwidmVyc2lvblN0cmluZ3MiLCJyZXF1aXJlIiwidmVyc2lvbiIsIm5wbV9wYWNrYWdlX3ZlcnNpb24iXSwicmFuZ2VNYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJtYXBwaW5ncyI6Ijs7OzsrQkF5ckJBOzs7ZUFBQTs7O3VCQTlxQk87bUVBMkJBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZVA7O0NBRUMsR0FDRCxJQUFBLEFBQWVB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