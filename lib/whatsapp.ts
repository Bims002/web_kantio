import { Order } from "./types";

export const TEST_WHATSAPP_NUMBER = "0616616340";

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

export function buildWhatsAppLink(message: string) {
  const number = TEST_WHATSAPP_NUMBER.replace(/\D/g, "");
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
