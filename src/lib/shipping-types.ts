export type ShippingIntegrationStatus =
  | { status: "connected"; mode: "sandbox" | "production" }
  | { status: "ready-to-connect"; message: string }
  | { status: "not-configured"; message: string };

export type ShippingQuoteOption = {
  id: string;
  company: string;
  service: string;
  price: string;
  deliveryDays: number;
  quoteToken: string;
};
