import {
  Logger,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types";
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberRawValue,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
} from "@medusajs/types";
import createMollieClient, {
  CaptureMethod,
  PaymentCreateParams,
  PaymentMethod,
  PaymentStatus,
} from "@mollie/api-client";
import { UpdateParameters } from "@mollie/api-client/dist/types/binders/payments/parameters";
import { PaymentData } from "@mollie/api-client/dist/types/data/payments/data";
import { PaymentOptions, ProviderOptions } from "../types";

/**
 * Dependencies injected into the service
 */
type InjectedDependencies = {
  logger: Logger;
};

/**
 * Implementation of Mollie Payment Provider for Medusa
 */
abstract class MollieBase extends AbstractPaymentProvider {
  protected readonly options_: ProviderOptions;
  protected logger_: Logger;
  protected client_: ReturnType<typeof createMollieClient>;
  protected debug_: boolean;

  /**
   * Validates that the required options are provided
   * @param options - The options to validate
   * @throws {MedusaError} If API key is missing
   */
  static validateOptions(options: ProviderOptions): void {
    if (!options.apiKey || !options.redirectUrl || !options.medusaUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "API key, redirect URL, and Medusa URL are required in the provider's options."
      );
    }
  }

  /**
   * Creates a new instance of the Mollie payment provider
   * @param container - The dependency container
   * @param options - Configuration options
   */
  constructor(container: InjectedDependencies, options: ProviderOptions) {
    super(container, options);

    this.logger_ = container.logger;
    this.options_ = options;
    this.debug_ =
      options.debug ||
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      false;

    this.client_ = createMollieClient({
      apiKey: options.apiKey,
      versionStrings: [
        "MedusaJS/" + require("@medusajs/medusa/package.json").version,
        "VariableVic/" + process.env.npm_package_version,
      ],
    });
  }

  abstract get paymentCreateOptions(): PaymentOptions;

  normalizePaymentCreateParams(): Partial<PaymentCreateParams> {
    const res = {} as Partial<PaymentCreateParams>;

    if (this.paymentCreateOptions.method) {
      res.method = this.paymentCreateOptions.method as PaymentMethod;
    }

    res.webhookUrl = this.paymentCreateOptions.webhookUrl;

    res.captureMode =
      this.paymentCreateOptions.captureMethod ??
      (this.options_.autoCapture !== false
        ? CaptureMethod.automatic
        : CaptureMethod.manual);

    return res;
  }

  /**
   * Initiates a new payment with Mollie
   * @param input - The payment initiation input
   * @returns The initiated payment details
   */
  async initiatePayment({
    context,
    amount,
    currency_code,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const normalizedParams = this.normalizePaymentCreateParams();
    try {
      const createParams: PaymentCreateParams = {
        ...normalizedParams,
        billingAddress: {
          streetAndNumber: context?.customer?.billing_address?.address_1 || "",
          postalCode: context?.customer?.billing_address?.postal_code || "",
          city: context?.customer?.billing_address?.city || "",
          country: context?.customer?.billing_address?.country_code || "",
        },
        billingEmail: context?.customer?.email || "",
        amount: {
          value: parseFloat(amount.toString()).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        description:
          this.options_.description || "Mollie payment created by Medusa",
        redirectUrl: this.options_.redirectUrl,
        metadata: {
          idempotency_key: context?.idempotency_key,
        },
      };

      const data = await this.client_.payments
        .create(createParams)
        .then((payment) => {
          return payment as Record<string, any>;
        })
        .catch((error) => {
          this.logger_.error(
            `Mollie payment creation failed: ${error.message}`
          );
          throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
        });

      this.debug_ &&
        this.logger_.info(
          `Mollie payment ${data.id} successfully created with amount ${amount}`
        );

      return {
        id: data.id,
        data: data,
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
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const externalId = input.data?.id;

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      );
    }

    try {
      const { status } = await this.getPaymentStatus({
        data: {
          id: externalId,
        },
      });

      if (!["captured", "authorized", "paid"].includes(status)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Payment is not authorized: current status is ${status}`
        );
      }

      this.debug_ &&
        this.logger_.info(
          `Mollie payment ${externalId} successfully authorized with status ${status}`
        );

      return {
        data: input.data,
        status,
      };
    } catch (error) {
      this.logger_.error(
        `Error authorizing payment ${externalId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Captures an authorized payment if autoCapture is disabled
   * @param input - The payment capture input
   * @returns The capture result
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const externalId = input.data?.id as string;

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      );
    }

    try {
      let status: PaymentSessionStatus | PaymentStatus;

      const data = await this.retrievePayment({
        data: {
          id: externalId,
        },
      }).then(({ data }) => data as unknown as PaymentData);

      status = data?.status as PaymentStatus;
      const captureMode = data?.captureMode as CaptureMethod;

      if (
        status === PaymentStatus.authorized &&
        captureMode === CaptureMethod.manual
      ) {
        await this.client_.paymentCaptures.create({
          paymentId: externalId,
        });
      }

      status = await this.getPaymentStatus({
        data: {
          id: externalId,
        },
      }).then((res) => res.status as PaymentSessionStatus);

      if (status !== PaymentSessionStatus.CAPTURED) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Payment is not captured: current status is ${status}`
        );
      }

      this.debug_ &&
        this.logger_.info(
          `Mollie payment ${externalId} captured with amount ${
            (input.data?.amount as BigNumberRawValue).currency_code
          } ${(input.data?.amount as BigNumberRawValue).value}`
        );

      const payment = await this.retrievePayment({
        data: {
          id: externalId,
        },
      });

      return {
        data: payment.data,
      };
    } catch (error) {
      this.logger_.error(
        `Error capturing payment ${externalId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Refunds a payment
   * @param input - The payment refund input
   * @returns The refund result
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const externalId = input.data?.id as string;

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      );
    }

    try {
      const payment = await this.retrievePayment({
        data: {
          id: externalId,
        },
      });

      const value = (input.data?.amount as BigNumberRawValue).value;
      const currency: string = (payment.data as Record<string, any>)?.amount
        ?.currency as string;

      if (!currency) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Currency information is missing from payment data"
        );
      }

      const refund = await this.client_.paymentRefunds.create({
        paymentId: externalId,
        amount: {
          value: parseFloat(value.toString()).toFixed(2),
          currency: currency.toUpperCase(),
        },
      });

      this.debug_ &&
        this.logger_.info(
          `Refund for Mollie payment ${externalId} created with amount ${currency.toUpperCase()} ${parseFloat(
            value.toString()
          ).toFixed(2)}`
        );

      return {
        data: { ...refund },
      };
    } catch (error) {
      this.logger_.error(
        `Error refunding payment ${externalId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Cancels a payment
   * @param input - The payment cancellation input
   * @returns The cancellation result
   */
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const { id } = input.data as Record<string, any>;

    try {
      const payment = await this.client_.payments.get(id);

      if (payment.status === PaymentStatus.expired) {
        this.debug_ &&
          this.logger_.info(
            `Mollie payment ${id} is already expired, no need to cancel`
          );
        return {
          data: {
            id: input.data?.id,
          },
        };
      }

      const newPayment = await this.client_.payments
        .cancel(id)
        .catch((error) => {
          this.logger_.warn(
            `Could not cancel Mollie payment ${id}: ${error.message}`
          );
          return { data: payment as Record<string, any> };
        });

      this.debug_ &&
        this.logger_.info(`Mollie payment ${id} cancelled successfully`);

      return {
        data: newPayment as Record<string, any>,
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
   */
  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input);
  }

  /**
   * Gets the status of a payment by mapping Mollie statuses to Medusa statuses
   * @param input - The payment status input
   * @returns The payment status
   */
  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const paymentId = input.data?.id as string;

    try {
      const { status } = await this.client_.payments.get(paymentId);

      const statusMap = {
        [PaymentStatus.open]: PaymentSessionStatus.REQUIRES_MORE,
        [PaymentStatus.canceled]: PaymentSessionStatus.CANCELED,
        [PaymentStatus.pending]: PaymentSessionStatus.PENDING,
        [PaymentStatus.authorized]: PaymentSessionStatus.AUTHORIZED,
        [PaymentStatus.expired]: PaymentSessionStatus.ERROR,
        [PaymentStatus.failed]: PaymentSessionStatus.ERROR,
        [PaymentStatus.paid]: PaymentSessionStatus.CAPTURED,
      };

      const mappedStatus = statusMap[status] as PaymentSessionStatus;

      this.debug_ &&
        this.logger_.debug(
          `Mollie payment ${paymentId} status: ${status} (mapped to: ${mappedStatus})`
        );

      return {
        status: mappedStatus,
      };
    } catch (error) {
      this.logger_.error(
        `Error retrieving payment status for ${paymentId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Retrieves payment details
   * @param input - The payment retrieval input
   * @returns The payment details
   */
  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const paymentId = input.data?.id as string;

    try {
      const data = await this.client_.payments.get(paymentId);
      return {
        data: data as Record<string, any>,
      };
    } catch (error) {
      this.logger_.error(
        `Error retrieving Mollie payment ${paymentId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Updates a payment
   * @param input - The payment update input
   * @returns The updated payment details
   */
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    this.debug_ &&
      this.logger_.info(
        "Note: Mollie does not allow updating amounts on an existing payment. \n" +
          "Check https://docs.mollie.com/reference/update-payment for allowed updates."
      );

    const {
      id,
      description,
      redirectUrl,
      cancelUrl,
      webhookUrl,
      metadata,
      restrictPaymentMethodsToCountry,
    } = input.data as UpdateParameters & {
      id: string;
    };

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
        data: data as Record<string, any>,
      };
    } catch (error) {
      this.logger_.error(
        `Error updating Mollie payment ${id}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Processes webhook data from Mollie
   * @param payload - The webhook payload
   * @returns The action and data to be processed
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data } = payload;

    try {
      const { data: payment } = await this.retrievePayment({
        data: {
          id: data.id,
        },
      }).catch((e) => {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, e.message);
      });

      if (!payment) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment not found");
      }

      const status = payment?.status as PaymentStatus;
      const session_id = (payment?.metadata as Record<string, any>)
        ?.idempotency_key;
      const amount = new BigNumber(payment?.amount as number);

      const baseData = {
        amount,
        session_id,
        ...payment,
      };

      switch (status) {
        case PaymentStatus.authorized:
          return {
            action: PaymentActions.AUTHORIZED,
            data: baseData,
          };
        case PaymentStatus.paid:
          return {
            action: PaymentActions.SUCCESSFUL,
            data: baseData,
          };
        case PaymentStatus.expired:
        case PaymentStatus.failed:
          return {
            action: PaymentActions.FAILED,
            data: baseData,
          };
        case PaymentStatus.canceled:
          return {
            action: PaymentActions.CANCELED,
            data: baseData,
          };
        case PaymentStatus.pending:
          return {
            action: PaymentActions.PENDING,
            data: baseData,
          };
        case PaymentStatus.open:
          return {
            action: PaymentActions.REQUIRES_MORE,
            data: baseData,
          };
        default:
          return {
            action: PaymentActions.NOT_SUPPORTED,
            data: baseData,
          };
      }
    } catch (error) {
      this.logger_.error(
        `Error processing webhook for payment ${data.id}: ${error.message}`
      );

      // Even with errors, try to construct a valid response if we have the payment
      const { data: payment } = await this.retrievePayment({
        data: { id: data.id },
      }).catch(() => ({ data: null }));

      if (payment) {
        return {
          action: "failed",
          data: {
            session_id: (payment?.metadata as Record<string, any>)?.session_id,
            amount: new BigNumber(payment?.amount as number),
            ...payment,
          },
        };
      }

      throw error;
    }
  }
}

export default MollieBase;
