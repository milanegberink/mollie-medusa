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
                    value: item.unit_price,
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
            // Only append shipping line if there's a shipping cost
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
                lines,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9sbGllLWJhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL21vbGxpZS9jb3JlL21vbGxpZS1iYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0EscURBTW1DO0FBc0JuQyxpRUFLNEI7QUFlNUI7O0dBRUc7QUFDSCxNQUFlLFVBQVcsU0FBUSwrQkFBdUI7SUFNdkQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBd0I7UUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xFLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQzlCLCtFQUErRSxDQUNoRixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsWUFBWSxTQUErQixFQUFFLE9BQXdCO1FBQ25FLEtBQUssQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFMUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxNQUFNO1lBQ1QsT0FBTyxDQUFDLEtBQUs7Z0JBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYTtnQkFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssTUFBTTtnQkFDL0IsS0FBSyxDQUFDO1FBRVIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLG9CQUFrQixFQUFDO1lBQ2hDLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtZQUN0QixjQUFjLEVBQUU7Z0JBQ2QsV0FBVyxHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLE9BQU87Z0JBQzlELGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjthQUNqRDtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFJRCw0QkFBNEI7UUFDMUIsTUFBTSxHQUFHLEdBQUcsRUFBa0MsQ0FBQztRQUUvQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNyQyxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUF1QixDQUFDO1FBQ2pFLENBQUM7UUFFRCxHQUFHLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7UUFFdEQsR0FBRyxDQUFDLFdBQVc7WUFDYixJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYTtnQkFDdkMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsS0FBSyxLQUFLO29CQUNsQyxDQUFDLENBQUMsMEJBQWEsQ0FBQyxTQUFTO29CQUN6QixDQUFDLENBQUMsMEJBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUU1QixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUNwQixJQUFJLEVBQ0osT0FBTyxFQUNQLE1BQU0sRUFDTixhQUFhLEdBQ1E7UUFDckIsTUFBTSxhQUFhLEdBQUcsSUFBSSxFQUFFLGNBQXdCLENBQUM7UUFFckQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUU3RCxNQUFNLE9BQU8sR0FBRyxDQUFDLElBQUksRUFBRSxlQUFlO1lBQ3BDLE9BQU8sRUFBRSxRQUFRLEVBQUUsZUFBZSxDQVN2QixDQUFDO1FBQ2QsTUFBTSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUV6QyxDQUFDO1FBQ2QsTUFBTSxLQUFLLEdBQUc7WUFDWixHQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQy9DLElBQUksRUFBRSxVQUE2QjtnQkFDbkMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxJQUFJLFNBQVM7Z0JBQzdELFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssSUFBSSxTQUFTO2dCQUNwRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7Z0JBQ3ZCLFNBQVMsRUFBRTtvQkFDVCxRQUFRLEVBQUUsYUFBYSxDQUFDLFdBQVcsRUFBRTtvQkFDckMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO2lCQUN2QjtnQkFDRCxXQUFXLEVBQUU7b0JBQ1gsUUFBUSxFQUFFLGFBQWEsQ0FBQyxXQUFXLEVBQUU7b0JBQ3JDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQ3BEO2dCQUNELE9BQU8sRUFBRSxNQUFNO2dCQUNmLFNBQVMsRUFBRTtvQkFDVCxRQUFRLEVBQUUsYUFBYSxDQUFDLFdBQVcsRUFBRTtvQkFDckMsS0FBSyxFQUFFLE1BQU07aUJBQ2Q7YUFDRixDQUFDLENBQUM7WUFDSCx1REFBdUQ7WUFDdkQsR0FBRyxDQUFDLGFBQWEsR0FBRyxDQUFDO2dCQUNuQixDQUFDLENBQUM7b0JBQ0U7d0JBQ0UsSUFBSSxFQUFFLGNBQWlDO3dCQUN2QyxJQUFJLEVBQUUsVUFBVTt3QkFDaEIsV0FBVyxFQUFFLFVBQVU7d0JBQ3ZCLFFBQVEsRUFBRSxDQUFDO3dCQUNYLFNBQVMsRUFBRTs0QkFDVCxRQUFRLEVBQUUsYUFBYSxDQUFDLFdBQVcsRUFBRTs0QkFDckMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO3lCQUNoQzt3QkFDRCxXQUFXLEVBQUU7NEJBQ1gsUUFBUSxFQUFFLGFBQWEsQ0FBQyxXQUFXLEVBQUU7NEJBQ3JDLEtBQUssRUFBRSxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzt5QkFDaEM7d0JBQ0QsT0FBTyxFQUFFLE1BQU07d0JBQ2YsU0FBUyxFQUFFOzRCQUNULFFBQVEsRUFBRSxhQUFhLENBQUMsV0FBVyxFQUFFOzRCQUNyQyxLQUFLLEVBQUUsTUFBTTt5QkFDZDtxQkFDRjtpQkFDRjtnQkFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO1NBQ1IsQ0FBQztRQUVGLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFFcEMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxZQUFZLEdBQXdCO2dCQUN4QyxHQUFHLGdCQUFnQjtnQkFFbkIsY0FBYyxFQUFFO29CQUNkLGVBQWUsRUFBRSxPQUFPLEVBQUUsU0FBUyxJQUFJLEVBQUU7b0JBQ3pDLFNBQVMsRUFBRSxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUU7b0JBQ3BDLFVBQVUsRUFBRSxPQUFPLEVBQUUsU0FBUyxJQUFJLEVBQUU7b0JBQ3BDLEtBQUs7b0JBQ0wsVUFBVSxFQUFFLE9BQU8sRUFBRSxXQUFXLElBQUksRUFBRTtvQkFDdEMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLElBQUksRUFBRTtvQkFDekIsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLElBQUksRUFBRTtpQkFDckM7Z0JBQ0QsWUFBWSxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUN6QixLQUFLO2dCQUNMLE1BQU0sRUFBRTtvQkFDTixLQUFLLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQy9DLFFBQVEsRUFBRSxhQUFhLENBQUMsV0FBVyxFQUFFO2lCQUN0QztnQkFDRCxXQUFXLEVBQ1QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksa0NBQWtDO2dCQUNqRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO2dCQUN0QyxRQUFRLEVBQUU7b0JBQ1IsZUFBZSxFQUFFLE9BQU8sRUFBRSxlQUFlO2lCQUMxQzthQUNGLENBQUM7WUFFRixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTtpQkFDckMsTUFBTSxDQUFDLFlBQVksQ0FBQztpQkFDcEIsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ2hCLE9BQU8sT0FBOEIsQ0FBQztZQUN4QyxDQUFDLENBQUM7aUJBQ0QsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQ2hCLG1DQUFtQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ25ELENBQUM7Z0JBQ0YsTUFBTSxJQUFJLG1CQUFXLENBQUMsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN2RSxDQUFDLENBQUMsQ0FBQztZQUVMLElBQUksQ0FBQyxNQUFNO2dCQUNULElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUNmLGtCQUFrQixJQUFJLENBQUMsRUFBRSxxQ0FBcUMsTUFBTSxFQUFFLENBQ3ZFLENBQUM7WUFFSixPQUFPO2dCQUNMLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDWCxJQUFJLEVBQUUsSUFBSTthQUNYLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN4RSxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FDcEIsS0FBNEI7UUFFNUIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFFbEMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQzlCLHdCQUF3QixDQUN6QixDQUFDO1FBQ0osQ0FBQztRQUVELElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDN0MsSUFBSSxFQUFFO29CQUNKLEVBQUUsRUFBRSxVQUFVO2lCQUNmO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDekQsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFDOUIsZ0RBQWdELE1BQU0sRUFBRSxDQUN6RCxDQUFDO1lBQ0osQ0FBQztZQUVELElBQUksQ0FBQyxNQUFNO2dCQUNULElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUNmLGtCQUFrQixVQUFVLHdDQUF3QyxNQUFNLEVBQUUsQ0FDN0UsQ0FBQztZQUVKLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO2dCQUNoQixNQUFNO2FBQ1AsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQ2hCLDZCQUE2QixVQUFVLEtBQUssS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUM1RCxDQUFDO1lBQ0YsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUNsQixLQUEwQjtRQUUxQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQVksQ0FBQztRQUU1QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDaEIsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFDOUIsd0JBQXdCLENBQ3pCLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsSUFBSSxNQUE0QyxDQUFDO1lBRWpELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQztnQkFDdEMsSUFBSSxFQUFFO29CQUNKLEVBQUUsRUFBRSxVQUFVO2lCQUNmO2FBQ0YsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQThCLENBQUMsQ0FBQztZQUV0RCxNQUFNLEdBQUcsSUFBSSxFQUFFLE1BQXVCLENBQUM7WUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxFQUFFLFdBQTRCLENBQUM7WUFFdkQsSUFDRSxNQUFNLEtBQUssMEJBQWEsQ0FBQyxVQUFVO2dCQUNuQyxXQUFXLEtBQUssMEJBQWEsQ0FBQyxNQUFNLEVBQ3BDLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUM7b0JBQ3hDLFNBQVMsRUFBRSxVQUFVO2lCQUN0QixDQUFDLENBQUM7WUFDTCxDQUFDO1lBRUQsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDO2dCQUNuQyxJQUFJLEVBQUU7b0JBQ0osRUFBRSxFQUFFLFVBQVU7aUJBQ2Y7YUFDRixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBOEIsQ0FBQyxDQUFDO1lBRXJELElBQUksTUFBTSxLQUFLLDRCQUFvQixDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUM3QyxNQUFNLElBQUksbUJBQVcsQ0FDbkIsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUM5Qiw4Q0FBOEMsTUFBTSxFQUFFLENBQ3ZELENBQUM7WUFDSixDQUFDO1lBRUQsSUFBSSxDQUFDLE1BQU07Z0JBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ2Ysa0JBQWtCLFVBQVUseUJBQzFCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUE0QixDQUFBLENBQUMsYUFDNUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBNEIsQ0FBQSxDQUFDLEtBQUssRUFBRSxDQUN0RCxDQUFDO1lBRUosTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDO2dCQUN6QyxJQUFJLEVBQUU7b0JBQ0osRUFBRSxFQUFFLFVBQVU7aUJBQ2Y7YUFDRixDQUFDLENBQUM7WUFFSCxPQUFPO2dCQUNMLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTthQUNuQixDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FDaEIsMkJBQTJCLFVBQVUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQzFELENBQUM7WUFDRixNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBeUI7UUFDM0MsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFZLENBQUM7UUFFNUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQzlCLHdCQUF3QixDQUN6QixDQUFDO1FBQ0osQ0FBQztRQUVELElBQUksQ0FBQztZQUNILE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQztnQkFDekMsSUFBSSxFQUFFO29CQUNKLEVBQUUsRUFBRSxVQUFVO2lCQUNmO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQTRCLENBQUEsQ0FBQyxLQUFLLENBQUM7WUFDOUQsTUFBTSxRQUFRLEdBQVksT0FBTyxDQUFDLElBQTRCLEVBQUUsTUFBTTtnQkFDcEUsRUFBRSxRQUFrQixDQUFDO1lBRXZCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDZCxNQUFNLElBQUksbUJBQVcsQ0FDbkIsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUM5QixtREFBbUQsQ0FDcEQsQ0FBQztZQUNKLENBQUM7WUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQztnQkFDdEQsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLE1BQU0sRUFBRTtvQkFDTixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQzlDLFFBQVEsRUFBRSxRQUFRLENBQUMsV0FBVyxFQUFFO2lCQUNqQzthQUNGLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxNQUFNO2dCQUNULElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUNmLDZCQUE2QixVQUFVLHdCQUF3QixRQUFRLENBQUMsV0FBVyxFQUFFLElBQUksVUFBVSxDQUNqRyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQ2pCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQ2YsQ0FBQztZQUVKLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLEVBQUUsR0FBRyxNQUFNLEVBQUU7YUFDcEIsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQ2hCLDJCQUEyQixVQUFVLEtBQUssS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUMxRCxDQUFDO1lBQ0YsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQXlCO1FBQzNDLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBMkIsQ0FBQztRQUVqRCxJQUFJLENBQUM7WUFDSCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUVwRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssMEJBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLE1BQU07b0JBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ2Ysa0JBQWtCLEVBQUUsd0NBQXdDLENBQzdELENBQUM7Z0JBQ0osT0FBTztvQkFDTCxJQUFJLEVBQUU7d0JBQ0osRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtxQkFDbkI7aUJBQ0YsQ0FBQztZQUNKLENBQUM7WUFFRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTtpQkFDM0MsTUFBTSxDQUFDLEVBQUUsQ0FBQztpQkFDVixLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDZixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FDZixtQ0FBbUMsRUFBRSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDMUQsQ0FBQztnQkFDRixPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQThCLEVBQUUsQ0FBQztZQUNsRCxDQUFDLENBQUMsQ0FBQztZQUVMLElBQUksQ0FBQyxNQUFNO2dCQUNULElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLHlCQUF5QixDQUFDLENBQUM7WUFFbkUsT0FBTztnQkFDTCxJQUFJLEVBQUUsVUFBaUM7YUFDeEMsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLEVBQUUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN2RSxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBeUI7UUFDM0MsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLGdCQUFnQixDQUNwQixLQUE0QjtRQUU1QixNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQVksQ0FBQztRQUUzQyxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFOUQsTUFBTSxTQUFTLEdBQUc7Z0JBQ2hCLENBQUMsMEJBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSw0QkFBb0IsQ0FBQyxhQUFhO2dCQUN4RCxDQUFDLDBCQUFhLENBQUMsUUFBUSxDQUFDLEVBQUUsNEJBQW9CLENBQUMsUUFBUTtnQkFDdkQsQ0FBQywwQkFBYSxDQUFDLE9BQU8sQ0FBQyxFQUFFLDRCQUFvQixDQUFDLE9BQU87Z0JBQ3JELENBQUMsMEJBQWEsQ0FBQyxVQUFVLENBQUMsRUFBRSw0QkFBb0IsQ0FBQyxVQUFVO2dCQUMzRCxDQUFDLDBCQUFhLENBQUMsT0FBTyxDQUFDLEVBQUUsNEJBQW9CLENBQUMsS0FBSztnQkFDbkQsQ0FBQywwQkFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLDRCQUFvQixDQUFDLEtBQUs7Z0JBQ2xELENBQUMsMEJBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSw0QkFBb0IsQ0FBQyxRQUFRO2FBQ3BELENBQUM7WUFFRixNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsTUFBTSxDQUF5QixDQUFDO1lBRS9ELElBQUksQ0FBQyxNQUFNO2dCQUNULElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUNoQixrQkFBa0IsU0FBUyxZQUFZLE1BQU0sZ0JBQWdCLFlBQVksR0FBRyxDQUM3RSxDQUFDO1lBRUosT0FBTztnQkFDTCxNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FDaEIsdUNBQXVDLFNBQVMsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3JFLENBQUM7WUFDRixNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxlQUFlLENBQ25CLEtBQTJCO1FBRTNCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBWSxDQUFDO1FBRTNDLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hELE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQTJCO2FBQ2xDLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUNoQixtQ0FBbUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDakUsQ0FBQztZQUNGLE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUF5QjtRQUMzQyxJQUFJLENBQUMsTUFBTTtZQUNULElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUNmLHlFQUF5RTtnQkFDdkUsNkVBQTZFLENBQ2hGLENBQUM7UUFFSixNQUFNLEVBQ0osRUFBRSxFQUNGLFdBQVcsRUFDWCxXQUFXLEVBQ1gsU0FBUyxFQUNULFVBQVUsRUFDVixRQUFRLEVBQ1IsK0JBQStCLEdBQ2hDLEdBQUcsS0FBSyxDQUFDLElBRVQsQ0FBQztRQUVGLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRTtnQkFDbEQsV0FBVztnQkFDWCxXQUFXO2dCQUNYLFNBQVM7Z0JBQ1QsVUFBVTtnQkFDVixRQUFRO2dCQUNSLCtCQUErQjthQUNoQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsTUFBTTtnQkFDVCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1lBRWpFLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQTJCO2FBQ2xDLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUNoQixpQ0FBaUMsRUFBRSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDeEQsQ0FBQztZQUNGLE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLHVCQUF1QixDQUMzQixPQUEwQztRQUUxQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDO1FBRXpCLElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDO2dCQUNuRCxJQUFJLEVBQUU7b0JBQ0osRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2lCQUNaO2FBQ0YsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNiLE1BQU0sSUFBSSxtQkFBVyxDQUFDLG1CQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDaEUsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxJQUFJLG1CQUFXLENBQUMsbUJBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDMUUsQ0FBQztZQUVELE1BQU0sTUFBTSxHQUFHLE9BQU8sRUFBRSxNQUF1QixDQUFDO1lBQ2hELE1BQU0sVUFBVSxHQUFJLE9BQU8sRUFBRSxRQUFnQztnQkFDM0QsRUFBRSxlQUFlLENBQUM7WUFDcEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBUyxDQUFDLE9BQU8sRUFBRSxNQUFnQixDQUFDLENBQUM7WUFFeEQsTUFBTSxRQUFRLEdBQUc7Z0JBQ2YsTUFBTTtnQkFDTixVQUFVO2dCQUNWLEdBQUcsT0FBTzthQUNYLENBQUM7WUFFRixRQUFRLE1BQU0sRUFBRSxDQUFDO2dCQUNmLEtBQUssMEJBQWEsQ0FBQyxVQUFVO29CQUMzQixPQUFPO3dCQUNMLE1BQU0sRUFBRSxzQkFBYyxDQUFDLFVBQVU7d0JBQ2pDLElBQUksRUFBRSxRQUFRO3FCQUNmLENBQUM7Z0JBQ0osS0FBSywwQkFBYSxDQUFDLElBQUk7b0JBQ3JCLE9BQU87d0JBQ0wsTUFBTSxFQUFFLHNCQUFjLENBQUMsVUFBVTt3QkFDakMsSUFBSSxFQUFFLFFBQVE7cUJBQ2YsQ0FBQztnQkFDSixLQUFLLDBCQUFhLENBQUMsT0FBTyxDQUFDO2dCQUMzQixLQUFLLDBCQUFhLENBQUMsTUFBTTtvQkFDdkIsT0FBTzt3QkFDTCxNQUFNLEVBQUUsc0JBQWMsQ0FBQyxNQUFNO3dCQUM3QixJQUFJLEVBQUUsUUFBUTtxQkFDZixDQUFDO2dCQUNKLEtBQUssMEJBQWEsQ0FBQyxRQUFRO29CQUN6QixPQUFPO3dCQUNMLE1BQU0sRUFBRSxzQkFBYyxDQUFDLFFBQVE7d0JBQy9CLElBQUksRUFBRSxRQUFRO3FCQUNmLENBQUM7Z0JBQ0osS0FBSywwQkFBYSxDQUFDLE9BQU87b0JBQ3hCLE9BQU87d0JBQ0wsTUFBTSxFQUFFLHNCQUFjLENBQUMsT0FBTzt3QkFDOUIsSUFBSSxFQUFFLFFBQVE7cUJBQ2YsQ0FBQztnQkFDSixLQUFLLDBCQUFhLENBQUMsSUFBSTtvQkFDckIsT0FBTzt3QkFDTCxNQUFNLEVBQUUsc0JBQWMsQ0FBQyxhQUFhO3dCQUNwQyxJQUFJLEVBQUUsUUFBUTtxQkFDZixDQUFDO2dCQUNKO29CQUNFLE9BQU87d0JBQ0wsTUFBTSxFQUFFLHNCQUFjLENBQUMsYUFBYTt3QkFDcEMsSUFBSSxFQUFFLFFBQVE7cUJBQ2YsQ0FBQztZQUNOLENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUNoQix3Q0FBd0MsSUFBSSxDQUFDLEVBQUUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3BFLENBQUM7WUFFRiw2RUFBNkU7WUFDN0UsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUM7Z0JBQ25ELElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO2FBQ3RCLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFakMsSUFBSSxPQUFPLEVBQUUsQ0FBQztnQkFDWixPQUFPO29CQUNMLE1BQU0sRUFBRSxRQUFRO29CQUNoQixJQUFJLEVBQUU7d0JBQ0osVUFBVSxFQUFHLE9BQU8sRUFBRSxRQUFnQyxFQUFFLFVBQVU7d0JBQ2xFLE1BQU0sRUFBRSxJQUFJLGlCQUFTLENBQUMsT0FBTyxFQUFFLE1BQWdCLENBQUM7d0JBQ2hELEdBQUcsT0FBTztxQkFDWDtpQkFDRixDQUFDO1lBQ0osQ0FBQztZQUVELE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQUVELGtCQUFlLFVBQVUsQ0FBQyJ9