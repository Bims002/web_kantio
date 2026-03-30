import { formatCityLabel } from "@/lib/cities";
import {
  getMissingDraftFields,
  getNextDraftQuestion,
  getRequiredFieldLabel,
  normalizeAssistantText,
  type OrderDraft,
} from "@/lib/order-assistant";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

function buildDraftSummary(draft: OrderDraft) {
  const items = draft.cart
    .map((item) => {
      const material = draft.selectedSupplier.supplier_materials.find(
        (entry) => entry.material_id === item.materialId
      );

      return `${material?.material?.name || "Materiau"} x${item.quantity}`;
    })
    .join(", ");

  return [
    `Fournisseur: ${draft.selectedSupplier.name}`,
    `Ville chantier: ${formatCityLabel(draft.siteInfo.city)}`,
    `Quartier de livraison: ${draft.siteInfo.address || "Manquant"}`,
    `Contact: ${draft.contactInfo.name} / ${draft.contactInfo.phone}`,
    `Notes: ${draft.contactInfo.notes || "Aucune"}`,
    `Panier: ${items || "Vide"}`,
    `Total estime: ${draft.totalAmount.toLocaleString("fr-FR")} FCFA`,
    `Delai fournisseur: ${draft.selectedSupplier.delivery_delay_hours}h`,
  ].join("\n");
}

function fallbackAssistantReply(draft: OrderDraft, userMessage: string) {
  const text = normalizeAssistantText(userMessage);
  const missing = getMissingDraftFields(draft);
  const nextQuestion = getNextDraftQuestion(draft);
  const cartSummary =
    draft.cart
      .map((item) => {
        const material = draft.selectedSupplier.supplier_materials.find(
          (entry) => entry.material_id === item.materialId
        );

        return `${material?.material?.name || "Materiau"} x${item.quantity}`;
      })
      .join(", ") || "aucun materiau";

  if (/^(bonjour|bonsoir|salut|hello|bjr)\b/.test(text)) {
    return nextQuestion
      ? `Bonjour. Je suis sur votre commande en cours. ${nextQuestion}`
      : "Bonjour. Je suis sur votre commande en cours. Dites-moi ce que vous voulez verifier.";
  }

  if (
    (text.includes("contact") || text.includes("telephone") || text.includes("whatsapp")) &&
    text.includes("fournisseur")
  ) {
    return nextQuestion
      ? `Je ne partage pas les coordonnees directes du fournisseur. Je gere la commande ici avec vous. ${nextQuestion}`
      : "Je ne partage pas les coordonnees directes du fournisseur. Je peux en revanche verifier le panier, la livraison et la finalisation avec vous.";
  }

  if (
    text.includes("prix") ||
    text.includes("total") ||
    text.includes("montant") ||
    text.includes("combien")
  ) {
    return `Pour l instant, votre commande contient ${cartSummary}. Le total estime est de ${draft.totalAmount.toLocaleString("fr-FR")} FCFA chez ${draft.selectedSupplier.name}.`;
  }

  if (text.includes("delai") || text.includes("livraison") || text.includes("quand")) {
    return `Le fournisseur ${draft.selectedSupplier.name} annonce un delai de ${draft.selectedSupplier.delivery_delay_hours}h. Si vous voulez, je peux aussi verifier si le quartier de livraison est assez clair pour le livreur.`;
  }

  if (text.includes("panier") || text.includes("materiau") || text.includes("materiaux")) {
    return `Votre panier actuel contient ${cartSummary}. Si vous voulez ajuster la commande, dites-moi simplement ce que vous voulez verifier ou changer.`;
  }

  if (text.includes("adresse") || text.includes("quartier") || text.includes("chantier")) {
    return draft.siteInfo.address.trim()
      ? `Le quartier de livraison renseigne est ${draft.siteInfo.address}, ${formatCityLabel(draft.siteInfo.city)}. Si vous voulez ajouter un repere utile pour le livreur, vous pouvez me le donner ici.`
      : nextQuestion || "Il me manque encore le quartier de livraison pour finaliser la commande.";
  }

  if (text.includes("contact") || text.includes("telephone") || text.includes("whatsapp")) {
    return draft.contactInfo.name.trim() && draft.contactInfo.phone.trim()
      ? "Le contact de reception est bien enregistre pour cette commande. Si vous devez le remplacer, donnez-moi les nouvelles informations ici."
      : nextQuestion || "Il me manque encore le contact de reception pour finaliser la commande.";
  }

  if (text.includes("manque") || text.includes("verifie") || text.includes("vérifie")) {
    return missing.length > 0
      ? `Il manque encore ${missing.map((field) => getRequiredFieldLabel(field)).join(", ")}. ${nextQuestion}`
      : "Tout est bon cote panier, livraison et contact. Si tout vous convient, vous pouvez finaliser la commande.";
  }

  return nextQuestion
    ? `Je reste concentree sur votre commande et sur les informations deja connues. ${nextQuestion}`
    : "Je peux vous aider naturellement sur le panier, le prix, le delai, la livraison, le contact de reception et la finalisation. Dites-moi ce que vous voulez verifier.";
}

function extractOpenRouterText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("choices" in payload)) {
    return null;
  }

  const choices = (payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  }).choices;
  const firstContent = choices?.[0]?.message?.content;

  if (typeof firstContent === "string") {
    return firstContent.trim();
  }

  if (Array.isArray(firstContent)) {
    return firstContent
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      contextSummary?: string;
      draft?: OrderDraft;
      messages?: ChatMessage[];
      preferredReply?: string;
    };

    if (!body.messages?.length || (!body.draft && !body.preferredReply)) {
      return Response.json({ error: "Contexte de commande manquant." }, { status: 400 });
    }

    const draftSummary = body.draft
      ? buildDraftSummary(body.draft)
      : body.contextSummary || "Contexte de commande partiel.";
    const fallback = body.draft
      ? fallbackAssistantReply(
          body.draft,
          body.messages[body.messages.length - 1]?.content || ""
        )
      : body.preferredReply || "Je peux vous aider sur cette commande.";
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

    if (!apiKey) {
      return Response.json({ message: body.preferredReply || fallback });
    }

    const instructions =
      "Tu es l'assistant de commande Kantioo. " +
      "Tu aides uniquement sur la commande en cours: panier, quantites, prix, fournisseur, delai, livraison, contact, prochaines etapes et finalisation. " +
      "Tu reponds comme une assistante de commande naturelle, concise, calme et utile. " +
      "Tu t appuies toujours sur les elements connus de la commande au lieu de repondre de facon generique. " +
      "Tu ne donnes pas l impression de lire un script ou des reponses pre-enregistrees. " +
      "Tu peux reformuler de facon fluide et chaleureuse, mais tu restes precise. " +
      "Tu ne dois jamais divulguer le numero, le WhatsApp ou une coordonnee directe du fournisseur, meme si l'utilisateur le demande. " +
      "S il manque des informations indispensables, pose une seule question a la fois pour les recueillir dans cet ordre: quartier de livraison, nom du contact, numero. " +
      "Si l'utilisateur sort de ce cadre, refuse poliment et recentre la conversation. " +
      "Reponses courtes, concretes, en francais. " +
      "IMPORTANT : Ta reponse finale DOIT STRICTEMENT etre un objet JSON contenant seulement 2 cles: \n" +
      "1. \"message\" : Ta reponse normale en texte clair (ex: 'Dans quel quartier faut-il livrer ?').\n" +
      "2. \"suggestions\" : Un tableau de 2 a 3 phrases courtes QUE L'UTILISATEUR POURRAIT CLIQUER POUR TE REPONDRE. Ce ne sont PAS tes questions, ce sont les REPONSES du client !\n" +
      "   - REGLE D'OR : Si tu poses une question dans le 'message', les 'suggestions' doivent etre les reponses probables a cette question.\n" +
      "   - EXEMPLE : Si message=\"Dans quel quartier êtes-vous ?\", alors suggestions=[\"Je suis à Akwa\", \"Bastos\", \"Bonapriso\"].\n" +
      "   - NE JAMAIS METTRE de points d'interrogation dans les suggestions.\n" +
      "Le code retourné doit être du JSON valide strict. Ne rajoute aucun commentaire en dehors du JSON." +
      `\n\nContexte de commande:\n${draftSummary}` +
      (body.preferredReply
        ? `\n\nBase factuelle a reformuler naturellement:\n${body.preferredReply}`
        : "");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Kantioo Order Assistant",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: instructions,
          },
          ...body.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        temperature: 0.6,
        max_tokens: 350,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return Response.json({ message: body.preferredReply || fallback });
    }

    const payload = (await response.json()) as unknown;
    const assistantText = extractOpenRouterText(payload);

    let finalMessage = assistantText || body.preferredReply || fallback;
    let finalSuggestions: string[] = [];

    if (assistantText) {
      try {
        let cleanText = assistantText.trim();
        // Remove markdown backticks if returned
        if (cleanText.startsWith("```json")) cleanText = cleanText.slice(7);
        if (cleanText.startsWith("```")) cleanText = cleanText.slice(3);
        if (cleanText.endsWith("```")) cleanText = cleanText.slice(0, -3);
        cleanText = cleanText.trim();

        const parsed = JSON.parse(cleanText);
        if (parsed.message) finalMessage = parsed.message;
        if (Array.isArray(parsed.suggestions)) finalSuggestions = parsed.suggestions;
      } catch (e) {
        console.warn("L'assistant n'a pas retourné de JSON valide:", assistantText);
      }
    }

    return Response.json({
      message: finalMessage,
      suggestions: finalSuggestions,
    });
  } catch (error) {
    console.error("Order assistant route error", error);

    return Response.json(
      { error: "Impossible de joindre l'assistant pour le moment." },
      { status: 500 }
    );
  }
}
