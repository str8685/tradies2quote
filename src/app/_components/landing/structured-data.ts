export const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "tradies2Quote",
  description:
    "Voice-first AI quoting app for tradies. Turn a 60-second voice memo into a professional, branded quote PDF emailed to your client.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android (PWA)",
  offers: [
    {
      "@type": "Offer",
      name: "Solo",
      price: "29",
      priceCurrency: "USD",
      priceValidUntil: "2099-12-31",
    },
    {
      "@type": "Offer",
      name: "Crew",
      price: "79",
      priceCurrency: "USD",
      priceValidUntil: "2099-12-31",
    },
    {
      "@type": "Offer",
      name: "Builder",
      price: "199",
      priceCurrency: "USD",
      priceValidUntil: "2099-12-31",
    },
  ],
  aggregateRating: undefined,
} as const;
