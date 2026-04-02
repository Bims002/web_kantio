import { Order } from "./types";

// No more test number - will use actual phone numbers
export const DEFAULT_COUNTRY_CODE = "237"; // Cameroon

function formatWhatsAppNumber(phone?: string) {
  if (!phone) return "";
  const rawNumber = phone;
  
  // Remove non-digits
  const digits = rawNumber.replace(/\D/g, "");
  
  // Cameroon format: 67..., 65..., 69..., etc (9 digits starting with 6) -> prepend 237
  if (digits.length === 9 && digits.startsWith("6")) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }
  
  // Cameroon format: 2... (8 digits starting with 2) -> prepend 237
  if (digits.length === 8 && digits.startsWith("2")) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // Already has country code (e.g. 2376...)
  if (digits.length >= 11) {
    return digits;
  }
  
  // If it has 9 digits starting with country code (237)
  if (digits.startsWith("237") && digits.length === 12) {
    return digits;
  }

  // Fallback: use digits as is
  return digits || "237600000000";
}

function getAppBaseUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

export function getOrderTrackingUrl(trackingToken: string) {
  const baseUrl = getAppBaseUrl().replace(/\/$/, "");

  return `${baseUrl}/suivi/${trackingToken}`;
}

export function buildWhatsAppLink(message: string, phone?: string) {
  const number = formatWhatsAppNumber(phone);
  const text = encodeURIComponent(message);

  return `https://wa.me/${number}?text=${text}`;
}

export function generateWhatsAppMessage(order: Order): string {
  const items = order.order_items
    ?.map(
      (item) =>
        `- ${item.material_name} - ${item.quantity} ${item.unit}`
    )
    .join("\n");
  const trackingUrl = getOrderTrackingUrl(order.tracking_token);

  const message =
    `Bonjour ${order.supplier_name || "fournisseur"}\n\n` +
    `Nouvelle commande via *Kantioo* :\n\n` +
    `*Materiaux :*\n${items || "Details non disponibles"}\n\n` +
    `*Adresse de livraison :* ${order.site_address}\n` +
    `*Nom du chantier :* ${order.site_name}\n` +
    `*Contact client :* ${order.contact_name} - ${order.contact_phone}\n` +
    `*Total :* Sans tarification (plateforme de mise en relation)\n` +
    `*Lien de suivi :* ${trackingUrl}\n\n` +
    `Merci de confirmer la reception de cette commande. \n*Joseph de Kantioo*`;

  return message;
}
