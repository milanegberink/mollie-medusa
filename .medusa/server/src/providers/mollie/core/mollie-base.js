"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const api_client_1 = __importStar(require("@mollie/api-client"));
/**
 * Implementation of Mollie Payment Provider for Medusa
 */
class MollieBase extends utils_1.AbstractPaymentProvider {
    /**
     * Validates that the required options are provided
     * @param options - The options to validate
     * @throws {MedusaError} If API key is missing
     */
    static validateOptions(options) {
        if (!options.apiKey || !options.redirectUrl || !options.medusaUrl) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "API key, redirect URL, and Medusa URL are required in the provider's options.");
        }
    }
    /**
     * Creates a new instance of the Mollie payment provider
     * @param container - The dependency container
     * @param options - Configuration options
     */
    constructor(container, options) {
        super(container, options);
        this.logger_ = container.logger;
        this.options_ = options;
        this.debug_ =
            options.debug ||
                process.env.NODE_ENV === "development" ||
                process.env.NODE_ENV === "test" ||
                false;
        this.client_ = (0, api_client_1.default)({
            apiKey: options.apiKey,
            versionStrings: [
                "MedusaJS/" + require("@medusajs/medusa/package.json").version,
                "VariableVic/" + process.env.npm_package_version,
            ],
        });
    }
    normalizePaymentCreateParams() {
        const res = {};
        if (this.paymentCreateOptions.method) {
            res.method = this.paymentCreateOptions.method;
        }
        res.webhookUrl = this.paymentCreateOptions.webhookUrl;
        res.captureMode =
            this.paymentCreateOptions.captureMethod ??
                (this.options_.autoCapture !== false
                    ? api_client_1.CaptureMethod.automatic
                    : api_client_1.CaptureMethod.manual);
        return res;
    }
    /**
     * Initiates a new payment with Mollie
     * @param input - The payment initiation input
     * @returns The initiated payment details
     */
    async initiatePayment({ data, context, amount, currency_code, }) {
        const shippingTotal = data?.shipping_total;
        const normalizedParams = this.normalizePaymentCreateParams();
        const billing = (data?.billing_address ??
            context?.customer?.billing_address);
        const email = (data?.email ?? context?.customer?.email);
        const lines = [
            ...(data?.items ?? []).map((item) => ({
                type: "physical",
                name: item.title || item.variant?.product?.title || "Product",
                description: item.title || item.variant?.product?.title || "Product",
                quantity: item.quantity,
                unitPrice: {
                    currency: currency_code.toUpperCase(),
                    value: item.unit_price.toFixed(2),
                },
                totalAmount: {
                    currency: currency_code.toUpperCase(),
                    value: (item.unit_price * item.quantity).toFixed(2),
                },
                vatRate: "0.00",
                vatAmount: {
                    currency: currency_code.toUpperCase(),
                    value: "0.00",
                },
            })),
            ...(shippingTotal > 0
                ? [
                    {
                        type: "shipping_fee",
                        name: "Shipping",
                        description: "Shipping",
                        quantity: 1,
                        unitPrice: {
                            currency: currency_code.toUpperCase(),
                            value: shippingTotal.toFixed(2),
                        },
                        totalAmount: {
                            currency: currency_code.toUpperCase(),
                            value: shippingTotal.toFixed(2),
                        },
                        vatRate: "0.00",
                        vatAmount: {
                            currency: currency_code.toUpperCase(),
                            value: "0.00",
                        },
                    },
                ]
                : []),
        ];
        console.dir(lines, { depth: null });
        const { captureMode, ...validNormalizedParams } = normalizedParams;
        try {
            const createParams = {
                // ← Orders type
                ...validNormalizedParams,
                locale: validNormalizedParams.locale ?? "nl_NL",
                orderNumber: context?.idempotency_key ?? `order-${Date.now()}`, // ← required field
                billingAddress: {
                    streetAndNumber: billing?.address_1 || "",
                    givenName: billing?.first_name || "",
                    familyName: billing?.last_name || "",
                    email,
                    postalCode: billing?.postal_code || "",
                    city: billing?.city || "",
                    country: billing?.country_code || "",
                    organizationName: "", // ← required by OrderAddress
                    phone: "", // ← required by OrderAddress
                },
                shippingAddress: {
                    // ← explicitly override to satisfy OrderAddress
                    streetAndNumber: billing?.address_1 || "",
                    givenName: billing?.first_name || "",
                    familyName: billing?.last_name || "",
                    email: email || "",
                    postalCode: billing?.postal_code || "",
                    city: billing?.city || "",
                    country: billing?.country_code || "",
                    organizationName: "",
                    phone: "",
                },
                lines,
                amount: {
                    value: parseFloat(amount.toString()).toFixed(2),
                    currency: currency_code.toUpperCase(),
                },
                redirectUrl: this.options_.redirectUrl,
                metadata: {
                    idempotency_key: context?.idempotency_key,
                },
            };
            const order = await this.client_.orders // ← renamed from `data`
                .create(createParams)
                .then((order) => {
                return order;
            })
                .catch((error) => {
                this.logger_.error(`Mollie order creation failed: ${error.message}`);
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, error.message);
            });
            this.debug_ &&
                this.logger_.info(`Mollie order ${order.id} successfully created with amount ${amount}`);
            return {
                id: order.id,
                data: order,
            };
        }
        catch (error) {
            this.logger_.error(`Error initiating Mollie order: ${error.message}`);
            throw error;
        }
    }
    /**
     * Checks if a payment is authorized with Mollie
     * @param input - The payment authorization input
     * @returns The authorization result
     */
    async authorizePayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            const { status } = await this.getPaymentStatus({
                data: {
                    id: externalId,
                },
            });
            if (!["captured", "authorized", "paid"].includes(status)) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Payment is not authorized: current status is ${status}`);
            }
            this.debug_ &&
                this.logger_.info(`Mollie payment ${externalId} successfully authorized with status ${status}`);
            return {
                data: input.data,
                status,
            };
        }
        catch (error) {
            this.logger_.error(`Error authorizing payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Captures an authorized payment if autoCapture is disabled
     * @param input - The payment capture input
     * @returns The capture result
     */
    async capturePayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            let status;
            const data = await this.retrievePayment({
                data: {
                    id: externalId,
                },
            }).then(({ data }) => data);
            status = data?.status;
            const captureMode = data?.captureMode;
            if (status === api_client_1.PaymentStatus.authorized &&
                captureMode === api_client_1.CaptureMethod.manual) {
                await this.client_.paymentCaptures.create({
                    paymentId: externalId,
                });
            }
            status = await this.getPaymentStatus({
                data: {
                    id: externalId,
                },
            }).then((res) => res.status);
            if (status !== utils_1.PaymentSessionStatus.CAPTURED) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Payment is not captured: current status is ${status}`);
            }
            this.debug_ &&
                this.logger_.info(`Mollie payment ${externalId} captured with amount ${(input.data?.amount).currency_code} ${(input.data?.amount).value}`);
            const payment = await this.retrievePayment({
                data: {
                    id: externalId,
                },
            });
            return {
                data: payment.data,
            };
        }
        catch (error) {
            this.logger_.error(`Error capturing payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Refunds a payment
     * @param input - The payment refund input
     * @returns The refund result
     */
    async refundPayment(input) {
        const externalId = input.data?.id;
        if (!externalId) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Payment ID is required");
        }
        try {
            const payment = await this.retrievePayment({
                data: {
                    id: externalId,
                },
            });
            const value = (input.data?.amount).value;
            const currency = payment.data?.amount
                ?.currency;
            if (!currency) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Currency information is missing from payment data");
            }
            const refund = await this.client_.paymentRefunds.create({
                paymentId: externalId,
                amount: {
                    value: parseFloat(value.toString()).toFixed(2),
                    currency: currency.toUpperCase(),
                },
            });
            this.debug_ &&
                this.logger_.info(`Refund for Mollie payment ${externalId} created with amount ${currency.toUpperCase()} ${parseFloat(value.toString()).toFixed(2)}`);
            return {
                data: { ...refund },
            };
        }
        catch (error) {
            this.logger_.error(`Error refunding payment ${externalId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Cancels a payment
     * @param input - The payment cancellation input
     * @returns The cancellation result
     */
    async cancelPayment(input) {
        const { id } = input.data;
        try {
            const payment = await this.client_.payments.get(id);
            if (payment.status === api_client_1.PaymentStatus.expired) {
                this.debug_ &&
                    this.logger_.info(`Mollie payment ${id} is already expired, no need to cancel`);
                return {
                    data: {
                        id: input.data?.id,
                    },
                };
            }
            const newPayment = await this.client_.payments
                .cancel(id)
                .catch((error) => {
                this.logger_.warn(`Could not cancel Mollie payment ${id}: ${error.message}`);
                return { data: payment };
            });
            this.debug_ &&
                this.logger_.info(`Mollie payment ${id} cancelled successfully`);
            return {
                data: newPayment,
            };
        }
        catch (error) {
            this.logger_.error(`Error cancelling payment ${id}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Deletes a payment (equivalent to cancellation as Mollie does not support deletion)
     * @param input - The payment deletion input
     * @returns The deletion result
     */
    async deletePayment(input) {
        return this.cancelPayment(input);
    }
    /**
     * Gets the status of a payment by mapping Mollie statuses to Medusa statuses
     * @param input - The payment status input
     * @returns The payment status
     */
    async getPaymentStatus(input) {
        const paymentId = input.data?.id;
        try {
            const { status } = await this.client_.payments.get(paymentId);
            const statusMap = {
                [api_client_1.PaymentStatus.open]: utils_1.PaymentSessionStatus.REQUIRES_MORE,
                [api_client_1.PaymentStatus.canceled]: utils_1.PaymentSessionStatus.CANCELED,
                [api_client_1.PaymentStatus.pending]: utils_1.PaymentSessionStatus.PENDING,
                [api_client_1.PaymentStatus.authorized]: utils_1.PaymentSessionStatus.AUTHORIZED,
                [api_client_1.PaymentStatus.expired]: utils_1.PaymentSessionStatus.ERROR,
                [api_client_1.PaymentStatus.failed]: utils_1.PaymentSessionStatus.ERROR,
                [api_client_1.PaymentStatus.paid]: utils_1.PaymentSessionStatus.CAPTURED,
            };
            const mappedStatus = statusMap[status];
            this.debug_ &&
                this.logger_.debug(`Mollie payment ${paymentId} status: ${status} (mapped to: ${mappedStatus})`);
            return {
                status: mappedStatus,
            };
        }
        catch (error) {
            this.logger_.error(`Error retrieving payment status for ${paymentId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Retrieves payment details
     * @param input - The payment retrieval input
     * @returns The payment details
     */
    async retrievePayment(input) {
        const paymentId = input.data?.id;
        try {
            const data = await this.client_.payments.get(paymentId);
            return {
                data: data,
            };
        }
        catch (error) {
            this.logger_.error(`Error retrieving Mollie payment ${paymentId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Updates a payment
     * @param input - The payment update input
     * @returns The updated payment details
     */
    async updatePayment(input) {
        this.debug_ &&
            this.logger_.info("Note: Mollie does not allow updating amounts on an existing payment. \n" +
                "Check https://docs.mollie.com/reference/update-payment for allowed updates.");
        const { id, description, redirectUrl, cancelUrl, webhookUrl, metadata, restrictPaymentMethodsToCountry, } = input.data;
        try {
            const data = await this.client_.payments.update(id, {
                description,
                redirectUrl,
                cancelUrl,
                webhookUrl,
                metadata,
                restrictPaymentMethodsToCountry,
            });
            this.debug_ &&
                this.logger_.info(`Mollie payment ${id} successfully updated`);
            return {
                data: data,
            };
        }
        catch (error) {
            this.logger_.error(`Error updating Mollie payment ${id}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Processes webhook data from Mollie
     * @param payload - The webhook payload
     * @returns The action and data to be processed
     */
    async getWebhookActionAndData(payload) {
        const { data } = payload;
        try {
            const { data: payment } = await this.retrievePayment({
                data: {
                    id: data.id,
                },
            }).catch((e) => {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, e.message);
            });
            if (!payment) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, "Payment not found");
            }
            const status = payment?.status;
            const session_id = payment?.metadata
                ?.idempotency_key;
            const amount = new utils_1.BigNumber(payment?.amount);
            const baseData = {
                amount,
                session_id,
                ...payment,
            };
            switch (status) {
                case api_client_1.PaymentStatus.authorized:
                    return {
                        action: utils_1.PaymentActions.AUTHORIZED,
                        data: baseData,
                    };
                case api_client_1.PaymentStatus.paid:
                    return {
                        action: utils_1.PaymentActions.SUCCESSFUL,
                        data: baseData,
                    };
                case api_client_1.PaymentStatus.expired:
                case api_client_1.PaymentStatus.failed:
                    return {
                        action: utils_1.PaymentActions.FAILED,
                        data: baseData,
                    };
                case api_client_1.PaymentStatus.canceled:
                    return {
                        action: utils_1.PaymentActions.CANCELED,
                        data: baseData,
                    };
                case api_client_1.PaymentStatus.pending:
                    return {
                        action: utils_1.PaymentActions.PENDING,
                        data: baseData,
                    };
                case api_client_1.PaymentStatus.open:
                    return {
                        action: utils_1.PaymentActions.REQUIRES_MORE,
                        data: baseData,
                    };
                default:
                    return {
                        action: utils_1.PaymentActions.NOT_SUPPORTED,
                        data: baseData,
                    };
            }
        }
        catch (error) {
            this.logger_.error(`Error processing webhook for payment ${data.id}: ${error.message}`);
            // Even with errors, try to construct a valid response if we have the payment
            const { data: payment } = await this.retrievePayment({
                data: { id: data.id },
            }).catch(() => ({ data: null }));
            if (payment) {
                return {
                    action: "failed",
                    data: {
                        session_id: payment?.metadata?.session_id,
                        amount: new utils_1.BigNumber(payment?.amount),
                        ...payment,
                    },
                };
            }
            throw error;
        }
    }
}
exports.default = MollieBase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWJhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL21vbGxpZS9jb3JlL21vbGxpZS1iYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0EscURBTW1DO0FBc0JuQyxpRUFLNEI7QUFpQjVCOztHQUVHO0FBQ0gsTUFBZSxVQUFXLFNBQVEsK0JBQXVCO0lBTXZEOzs7O09BSUc7SUFDSCxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQXdCO1FBQzdDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNsRSxNQUFNLElBQUksbUJBQVcsQ0FDbkIsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUM5QiwrRUFBK0UsQ0FDaEYsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFlBQVksU0FBK0IsRUFBRSxPQUF3QjtRQUNuRSxLQUFLLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRTFCLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNoQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztRQUN4QixJQUFJLENBQUMsTUFBTTtZQUNULE9BQU8sQ0FBQyxLQUFLO2dCQUNiLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLGFBQWE7Z0JBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLE1BQU07Z0JBQy9CLEtBQUssQ0FBQztRQUVSLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSxvQkFBa0IsRUFBQztZQUNoQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDdEIsY0FBYyxFQUFFO2dCQUNkLFdBQVcsR0FBRyxPQUFPLENB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