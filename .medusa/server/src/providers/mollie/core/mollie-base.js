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
        console.log("Payment data:", JSON.stringify(data, null, 2));
        const normalizedParams = this.normalizePaymentCreateParams();
        const billing = (data?.billing_address ??
            context?.customer?.billing_address);
        const email = (data?.email ?? context?.customer?.email);
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
                    country: billing?.country_code || "",
                },
                billingEmail: email || "",
                amount: {
                    value: parseFloat(amount.toString()).toFixed(2),
                    currency: currency_code.toUpperCase(),
                },
                description: this.options_.description || "Mollie payment created by Medusa",
                redirectUrl: this.options_.redirectUrl,
                metadata: {
                    idempotency_key: context?.idempotency_key,
                },
            };
            const data = await this.client_.payments
                .create(createParams)
                .then((payment) => {
                return payment;
            })
                .catch((error) => {
                this.logger_.error(`Mollie payment creation failed: ${error.message}`);
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, error.message);
            });
            this.debug_ &&
                this.logger_.info(`Mollie payment ${data.id} successfully created with amount ${amount}`);
            return {
                id: data.id,
                data: data,
            };
        }
        catch (error) {
            this.logger_.error(`Error initiating Mollie payment: ${error.message}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWJhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL21vbGxpZS9jb3JlL21vbGxpZS1iYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0EscURBTW1DO0FBc0JuQyxpRUFLNEI7QUFZNUI7O0dBRUc7QUFDSCxNQUFlLFVBQVcsU0FBUSwrQkFBdUI7SUFNdkQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBd0I7UUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xFLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQzlCLCtFQUErRSxDQUNoRixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsWUFBWSxTQUErQixFQUFFLE9BQXdCO1FBQ25FLEtBQUssQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFMUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxNQUFNO1lBQ1QsT0FBTyxDQUFDLEtBQUs7Z0JBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYTtnQkFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssTUFBTTtnQkFDL0IsS0FBSyxDQUFDO1FBRVIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLG9CQUFrQixFQUFDO1lBQ2hDLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtZQUN0QixjQUFjLEVBQUU7Z0JBQ2QsV0FBVyxHQUFHLE9BQU8sQ0FB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