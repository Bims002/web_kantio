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
      const material = draft.selectedSupplier?.supplier_materials.find(
        (entry) => entry.material_id === item.materialId
      );

      return `${material?.material?.name || "Materiau"} x${item.quantity}`;
    })
    .join(", ");

  return [
    `Fournisseur: ${draft.selectedSupplier?.name || "Non selectionne"}`,
    `Ville chantier: ${formatCityLabel(draft.siteInfo.city)}`,
    `Quartier de livraison: ${draft.siteInfo.address || "Manquant"}`,
    `Contact: ${draft.contactInfo.name} / ${draft.contactInfo.phone}`,
    `Notes: ${draft.contactInfo.notes || "Aucune"}`,
    `Panier: ${items || "Vide"}`,
    `Delai fournisseur: ${draft.selectedSupplier?.delivery_delay_hours || "Inconnu"}h`,
  ].join("\n");
}

function fallbackAssistantReply(draft: OrderDraft, userMessage: string) {
  const text = normalizeAssistantText(userMessage);
  const missing = getMissingDraftFields(draft);
  const nextQuestion = getNextDraftQuestion(draft);
  const cartSummary =
    draft.cart
      .map((item) => {
        const material = draft.selectedSupplier?.supplier_materials.find(
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
      ? `Je ne partage pas les coordonnees du fournisseur car c'est Kantioo qui s'en occupe. ${nextQuestion}`
      : "Je ne partage pas les coordonnees directes du fournisseur. Je suis la pour coordonner votre commande.";
  }

  if (
    text.includes("panier") ||
    text.includes("produit") ||
    text.includes("article") ||
    text.includes("materiau")
  ) {
    if (draft.cart.length > 0) {
      return `Votre panier contient ${cartSummary}. ${nextQuestion || ""}`;
    }
    return nextQuestion || "Que souhaitez-vous commander (ex: ciment, sable, fer) ?";
  }

  if (text.includes("adresse") || text.includes("quartier") || text.includes("chantier")) {
    if (draft.siteInfo.address.trim()) {
      return nextQuestion 
        ? `C'est bien note pour ${draft.siteInfo.address}. ${nextQuestion}`
        : `Le quartier de livraison est ${draft.siteInfo.address}. Tout est pret pour la commande.`;
    }
    return nextQuestion || "Dans quel quartier se trouve votre chantier ?";
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

  return nextQuestion || "Je suis prêt pour la suite.";
}

function extractHuggingFaceText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("choices" in payload)) {
    return null;
  }

  // ARIA-7B-V3 uses OpenAI compatible format (chat completions)
  const choices = (payload as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  }).choices;
  
  const firstContent = choices?.[0]?.message?.content;

  if (typeof firstContent === "string") {
    return firstContent.trim();
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
      filterContext?: string;
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
    const apiKey = process.env.HF_API_KEY;
    const hfModel = "Faradaylab/ARIA-7B-V3";

    if (!apiKey) {
      return Response.json({ message: body.preferredReply || fallback });
    }

    const filterInstruction = body.filterContext ? `\n${body.filterContext}` : "";

    // Build conversation history for HuggingFace
    const conversationHistory = body.messages
      .map((msg) => `${msg.role === "user" ? "Utilisateur" : "Assistant"}: ${msg.content}`)
      .join("\n");

    // Build full prompt for HuggingFace (single text input)
    const prompt =
      "Tu es l'assistant de commande Kantioo. " +
      "Tu aides uniquement sur la commande en cours: panier, quantites, fournisseur, delai, livraison, contact, prochaines etapes et finalisation. " +
      "Tu ne parles JAMAIS de prix, de tarifs ou de montants, car Kantioo ne gere plus les prix directement. " +
      "Tu reponds comme une assistante de commande naturelle, concise, calme et utile. " +
      "Tu t appuies toujours sur les elements connus de la commande au lieu de repondre de facon generique. " +
      "Tu ne donnes pas l impression de lire un script ou des reponses pre-enregistrees. " +
      "Tu peux reformuler de facon fluide et chaleureuse, mais tu restes precise. " +
      "Tu ne dois jamais divulguer le numero, le WhatsApp ou une coordonnee directe du fournisseur, meme si l'utilisateur le demande. " +
      "S il manque des informations indispensables, pose une seule question a la fois pour les recueillir dans cet ordre: quartier de livraison, nom du contact, numero. " +
      "Si l'utilisateur sort de ce cadre, refuse poliment et recentre la conversation. " +
      "Reponses courtes, concretes, en francais. " +
      "IMPORTANT : Ta reponse doit être calme et naturelle." +
      `\n\nContexte de commande:\n${draftSummary}` +
      (body.preferredReply
        ? `\n\nBase factuelle a reformuler naturellement:\n${body.preferredReply}`
        : "") +
      filterInstruction +
      `\n\nHistorique de conversation:\n${conversationHistory}\n\nAssistant:`;

    let assistantText: string | null = null;
    
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "Tu es l'assistant de commande Kantioo. Tu aides uniquement sur la commande en cours. Tu ne parles JAMAIS de prix. Tu reponds de maniere naturelle, concise, calme et utile en francais.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.6,
          max_tokens: 350,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HuggingFace API error", response.status, errorText);
      } else {
        const payload = (await response.json()) as unknown;
        console.log("HuggingFace response", payload);
        assistantText = extractHuggingFaceText(payload);
      }
    } catch (apiError) {
      console.error("HuggingFace API call failed", apiError);
    }

    return Response.json({
      message: assistantText || body.preferredReply || fallback,
      suggestions: [],
    });
  } catch (error) {
    console.error("Order assistant route error", error);

    return Response.json(
      { error: "Impossible de joindre l'assistant pour le moment." },
      { status: 500 }
    );
  }
}
