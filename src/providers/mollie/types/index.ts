import { CaptureMethod } from "@mollie/api-client";

/**
 * Configuration options for the Mollie payment provider
 * @property apiKey - The Mollie API key
 * @property redirectUrl - The URL to redirect to after payment
 * @property medusaUrl - The URL of the Medusa instance - defaults to http://localhost:9000
 * @property autoCapture - Whether to automatically capture payments - defaults to true
 * @property description - The description that appears on the payment
 * @property debug - Whether to enable debug mode
 */
export type ProviderOptions = {
  apiKey: string;
  redirectUrl: string;
  medusaUrl: string;
  autoCapture?: boolean;
  description?: string;
  debug?: boolean;
};

export type PaymentOptions = {
  method?: string;
  webhookUrl?: string;
  captureMethod?: CaptureMethod;
};

export const PaymentProviderKeys = {
  MOLLIE_HOSTED_CHECKOUT: "mollie-hosted-checkout",
  IDEAL: "mollie-ideal",
  CREDIT_CARD: "mollie-card",
  BANCONTACT: "mollie-bancontact",
  GIFT_CARD: "mollie-giftcard",
  PAYPAL: "mollie-paypal",
  APPLE_PAY: "mollie-apple-pay",
  KLARNA: "mollie-klarna-pay-later",
};
