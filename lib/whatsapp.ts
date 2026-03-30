import { Order } from "./types";

export const TEST_WHATSAPP_NUMBER = "33616616340";
export const DEFAULT_COUNTRY_CODE = "33";

function formatWhatsAppNumber(phone?: string) {
  const rawNumber = phone || TEST_WHATSAPP_NUMBER;
  if (!rawNumber) return "";
  
  // Remove non-digits
  const digits = rawNumber.replace(/\D/g, "");
  
  // French format: 06... (10 digits) -> replace 0 with 33
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }
  
  // French format: 6... (9 digits) -> prepend 33
  if (digits.length === 9 && (digits.startsWith("6") || digits.startsWith("7"))) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // Already has country code (e.g. 336... or 2376...)
  if (digits.length >= 11) {
    return digits;
  }

  // Fallback: use digits as is or prepend default if it looks like a local number
  return digits;
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
        `- ${item.material_name} - ${item.quantity} ${item.unit} (${item.unit_price.toLocaleString("fr-FR")} FCFA/${item.unit})`
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
    `*Total estime :* ${order.total_price?.toLocaleString("fr-FR")} FCFA\n` +
    `*Lien de suivi :* ${trackingUrl}\n\n` +
    `Merci de confirmer la reception de cette commande. \n*Joseph de Kantioo*`;

  return message;
}
