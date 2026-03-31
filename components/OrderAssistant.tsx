'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyDraftFieldAnswer,
  extractRequestedQuantity,
  findMaterialMatches,
  findMaterialsInCategory,
  getMaterialsByCategory,
  getCompatibleSuppliersForMaterial,
  getDraftLines,
  getNextDraftField,
  getNextDraftQuestion,
  getRequiredFieldLabel,
  isConfidentMaterialMatch,
  recommendSupplierForMaterial,
  type RecommendationContext,
  type RecommendationMaterial,
  validateDraftFieldAnswer,
  validateOrderDraft,
  type OrderDraft,
} from '@/lib/order-assistant';
import SupplierMap from '@/components/SupplierMap';
import { formatCityLabel, normalizeCityKey } from '@/lib/cities';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppLink, generateWhatsAppMessage } from '@/lib/whatsapp';
import type { Order } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Truck,
  User,
} from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  suggestions?: string[];
}

const STORAGE_KEY = 'kantioo-order-draft';
const ASSISTANT_TYPING_DELAY_MS = 3000;

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function looksLikeOrderQuestion(message: string) {
  const text = message.trim().toLowerCase();

  return (
    text.includes('?') ||
    /(prix|total|montant|delai|livraison|fournisseur|panier|commande|manque|verifie|vérifie|whatsapp|contact|telephone)/.test(
      text
    )
  );
}

function looksLikeFieldAnswer(message: string, field: ReturnType<typeof getNextDraftField>) {
  if (!field) {
    return false;
  }

  if (field === 'contactPhone') {
    return message.replace(/\D/g, '').length >= 7;
  }

  return !looksLikeOrderQuestion(message);
}

function buildCaptureReply(draft: OrderDraft) {
  const nextQuestion = getNextDraftQuestion(draft);

  if (nextQuestion) {
    return `✓ C'est note. ${nextQuestion}`;
  }

  return (
    '✓ Parfait! Toutes les informations sont collectees.\n\n' +
    'Que voulez-vous faire?\n' +
    '• Ajouter un autre materiau\n' +
    '• Valider la commande\n' +
    '• Verifier les details (panier, livraison)'
  );
}

function buildRecommendationOpeningMessage(city: string) {
  return `Bienvenue ! 👋 Je suis votre assistant d'achat pour ${formatCityLabel(city)}. Je vais vous trouver les meilleurs fournisseurs rapidement.\n\nDites-moi simplement le materiau ET la quantite, par exemple :\n• "ciment 20" ou "20 sacs de ciment"\n• "sable 5" ou "5 tonnes de sable"\n• "fer 100" ou "100 kg de fer"`;
}

function buildRecommendationReply(input: {
  city: string;
  materialName: string;
  recommendation: NonNullable<ReturnType<typeof recommendSupplierForMaterial>>;
}) {
  const { city, materialName, recommendation } = input;
  const { matchedMaterial } = recommendation;

  if (!matchedMaterial) {
    return "Je n ai pas reussi a finaliser la recommandation du fournisseur pour ce materiau. Donnez-moi un autre materiau et je relance l analyse.";
  }

  const nextQuestion = getNextDraftQuestion(recommendation.draft);
  const priceLine = `${matchedMaterial.price.toLocaleString('fr-FR')} FCFA par ${matchedMaterial.unit}`;
  const distanceLine = `${recommendation.distanceKm.toFixed(1)} km`;

  return (
    `Voici ce que j'ai trouve pour ${materialName} d'apres votre localisation :\n` +
    `✅ ${recommendation.supplier.name}\n` +
    `📍 Distance : ${distanceLine}\n` +
    `${nextQuestion || "Confirmer cette commande ?"}`.trim()
  );
}

function buildOpeningMessage(draft: OrderDraft) {
  const validationError = validateOrderDraft(draft);
  const nextQuestion = getNextDraftQuestion(draft);

  if (!validationError) {
    return 'Votre dossier est deja complet. Je peux verifier le panier, la livraison ou vous laisser finaliser.';
  }

  return nextQuestion || 'Je suis pret a poursuivre la commande.';
}

interface ChatBubbleProps {
  role: 'assistant' | 'user';
  content: string;
}

function ChatBubble({ content, role }: ChatBubbleProps) {
  const lines = content.split('\n');
  return (
    <div className={`flex ${role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-[24px] px-4 py-4 text-sm leading-7 ${
            role === 'assistant'
              ? 'bg-kantioo-sand text-kantioo-dark'
              : 'bg-kantioo-dark text-white'
          }`}
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
          {role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
          {role === 'assistant' ? 'Assistant' : 'Vous'}
        </div>
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OrderAssistant({
  initialDraft,
  recommendationContext,
}: {
  initialDraft?: OrderDraft | null;
  recommendationContext?: RecommendationContext | null;
}) {
  const router = useRouter();
  const conversationRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingRecommendationMaterial, setPendingRecommendationMaterial] =
    useState<RecommendationMaterial | null>(null);
  const [suggestedMaterials, setSuggestedMaterials] = useState<RecommendationMaterial[]>([]);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [alternativeMaterials, setAlternativeMaterials] = useState<RecommendationMaterial[]>([]);

  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem(STORAGE_KEY);
      const storedDraft = rawDraft ? (JSON.parse(rawDraft) as OrderDraft) : null;
      const parsedDraft =
        initialDraft || (recommendationContext ? null : storedDraft);

      if (!parsedDraft && !recommendationContext) {
        setErrorMessage('Aucun brouillon de commande n est disponible.');
        return;
      }

      if (parsedDraft) {
        setDraft(parsedDraft);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsedDraft));
        setMessages([
          {
            role: 'assistant',
            content: buildOpeningMessage(parsedDraft),
          },
        ]);
        return;
      }

      if (recommendationContext) {
        sessionStorage.removeItem(STORAGE_KEY);
        const initialLocationDraft: OrderDraft = {
          cart: [],
          siteInfo: {
            name: '',
            address: '',
            city: recommendationContext.city,
            lat: null,
            lng: null,
          },
          contactInfo: {
            name: '',
            phone: '',
            notes: '',
          },
          totalAmount: 0,
          createdAt: new Date().toISOString(),
        };
        setDraft(initialLocationDraft);
        setMessages([
          {
            role: 'assistant',
            content: `D'accord, dans quel quartier de ${formatCityLabel(recommendationContext.city)} se trouve votre chantier ?`,
          },
        ]);
        return;
      }
    } catch (error) {
      console.error('Draft loading error', error);
      setErrorMessage('Impossible de charger le brouillon de commande.');
    }
  }, [initialDraft, recommendationContext]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    const conversationNode = conversationRef.current;

    if (!conversationNode) {
      return;
    }

    conversationNode.scrollTo({
      top: conversationNode.scrollHeight,
      behavior: 'smooth',
    });
  }, [loadingReply, messages]);

  const draftLines = useMemo(() => (draft ? getDraftLines(draft) : []), [draft]);
  const draftValidationError = draft ? validateOrderDraft(draft) : null;
  const nextDraftField = getNextDraftField(draft);
  const nextDraftQuestion = getNextDraftQuestion(draft);
  const activeMaterial = useMemo(() => {
    if (pendingRecommendationMaterial) {
      return pendingRecommendationMaterial;
    }

    if (!recommendationContext || !draft?.cart.length) {
      return null;
    }

    return (
      recommendationContext.materials.find(
        (material) => material.id === draft.cart[0]?.materialId
      ) || null
    );
  }, [draft, pendingRecommendationMaterial, recommendationContext]);
  const compatibleSuppliers = useMemo(() => {
    if (!recommendationContext) {
      return [];
    }

    return getCompatibleSuppliersForMaterial(
      recommendationContext,
      activeMaterial?.id || null
    );
  }, [activeMaterial, recommendationContext]);
  const mapCity = recommendationContext?.city || draft?.siteInfo.city || '';
  const mapCenter: [number, number] =
    normalizeCityKey(mapCity) === 'douala'
      ? [9.7, 4.05]
      : normalizeCityKey(mapCity) === 'yaounde'
        ? [11.5167, 3.8667]
        : [11.5167, 3.8667];
  const mapZoom = recommendationContext ? 10 : 6;
  const recommendationSummary = recommendationContext
    ? [
      `Ville de recherche: ${formatCityLabel(recommendationContext.city)}`,
      `Materiau compris: ${activeMaterial?.name || 'Non confirme'}`,
      `Suggestions en cours: ${suggestedMaterials.length
        ? suggestedMaterials.map((material) => material.name).join(', ')
        : 'Aucune'
      }`,
    ].join('\n')
    : undefined;

  const resolveAssistantReply = async (input: {
    nextUserMessage: ChatMessage;
    preferredReply?: string;
    draftOverride?: OrderDraft | null;
  }) => {
    const { draftOverride, nextUserMessage, preferredReply } = input;
    const requestDraft = draftOverride ?? draft;

    if (!requestDraft && !preferredReply) {
      return {
        message: "Je suis la pour vous aider sur cette commande. Dites-moi ce que vous voulez verifier.",
        suggestions: []
      };
    }

    try {
      const response = await fetch('/api/order-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextSummary: recommendationSummary,
          draft: requestDraft,
          messages: [...messages, nextUserMessage],
          preferredReply,
        }),
      });

      const payload = (await response.json()) as { message?: string; suggestions?: string[]; error?: string };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error || 'Aucune reponse de l assistant.');
      }

      return { message: payload.message, suggestions: payload.suggestions };
    } catch (error) {
      console.error('Assistant reply error', error);

      return {
        message:
          preferredReply ||
          "Je n'arrive pas a repondre pour l'instant. Je peux quand meme vous laisser finaliser la commande si tout est correct.",
        suggestions: [],
      };
    }
  };

  const queueAssistantReply = async (input: {
    nextUserMessage: ChatMessage;
    preferredReply?: string;
    draftOverride?: OrderDraft | null;
  }) => {
    const [assistantResponse] = await Promise.all([
      resolveAssistantReply(input),
      wait(ASSISTANT_TYPING_DELAY_MS),
    ]);

    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: assistantResponse.message,
        suggestions: assistantResponse.suggestions,
      },
    ]);
    setLoadingReply(false);
  };

  const handleRecommendationFlow = (
    userMessage: string,
    siteCoords?: { lat: number; lng: number } | null
  ) => {
    if (!recommendationContext) {
      return null;
    }

    const quantity = extractRequestedQuantity(userMessage);

    if (pendingRecommendationMaterial) {
      if (!quantity) {
        return {
          draftOverride: null,
          reply: `J ai bien retenu ${pendingRecommendationMaterial.name}. Quelle quantite souhaitez-vous commander ? (par exemple: 20 ${pendingRecommendationMaterial.unit}, 100 ${pendingRecommendationMaterial.unit}...)`,
        };
      }

      const recommendation = recommendSupplierForMaterial({
        context: recommendationContext,
        materialId: pendingRecommendationMaterial.id,
        quantity,
        siteCoords,
        existingSiteInfo: draft?.siteInfo,
      });

      if (!recommendation) {
        setPendingRecommendationMaterial(null);
        return {
          draftOverride: null,
          reply:
            "Je n ai pas trouve de fournisseur actif pour ce materiau dans cette ville. Donnez-moi un autre materiau et je relance l analyse.",
        };
      }

      setDraft(recommendation.draft);
      setPendingRecommendationMaterial(null);
      setSuggestedMaterials([]);
      setDetectedCategory(null);
      setAlternativeMaterials([]);

      return {
        draftOverride: recommendation.draft,
        reply: buildRecommendationReply({
          city: recommendationContext.city,
          materialName: pendingRecommendationMaterial.name,
          recommendation,
        }),
      };
    }

    // FIRST: Check if input is exactly a category
    const normalizedInput = userMessage.toLowerCase().trim();
    const uniqueCategories = Array.from(
      new Set(recommendationContext.materials.map((m) => m.category).filter(Boolean))
    );
    const matchedCategory = uniqueCategories.find(
      (cat) => cat && cat.toLowerCase() === normalizedInput
    );

    if (matchedCategory) {
      const categoryMaterials = getMaterialsByCategory(matchedCategory, recommendationContext.materials);
      if (categoryMaterials.length > 0) {
        setDetectedCategory(matchedCategory);
        setAlternativeMaterials(categoryMaterials);
        setSuggestedMaterials(categoryMaterials);

        const list = categoryMaterials.map((m) => m.name).join(', ');
        return {
          draftOverride: null,
          reply: `Parfait ! Voici tous les ${matchedCategory} disponibles :\n${list}\n\nLequel vous interesse ?`,
        };
      }
    }

    // THEN: Try fuzzy matching
    const matches = findMaterialMatches(
      userMessage,
      suggestedMaterials.length > 0 ? suggestedMaterials : recommendationContext.materials
    );

    if (!matches.length) {
      // Try to find materials by category
      const categorySearch = findMaterialsInCategory(
        userMessage,
        recommendationContext.materials
      );

      if (categorySearch.category && categorySearch.matches.length > 0) {
        // Found a category with matches
        const alternatives = getMaterialsByCategory(
          categorySearch.category,
          recommendationContext.materials
        );

        if (alternatives.length > 0) {
          setDetectedCategory(categorySearch.category);
          setAlternativeMaterials(alternatives);
          setSuggestedMaterials(alternatives);

          const list = alternatives.map((m) => m.name).join(', ');
          return {
            draftOverride: null,
            reply: `Je n'ai pas trouve "${userMessage}" exactement, mais voici tous les ${categorySearch.category} disponibles :\n${list}\n\nLequel vous interesse ?`,
          };
        }
      }

      setSuggestedMaterials([]);
      setDetectedCategory(null);
      setAlternativeMaterials([]);
      return {
        draftOverride: null,
        reply:
          'Je n\'ai pas trouve ce materiau. Essayez un nom simple :\nciment, sable, gravier, fer, beton, peinture, cable electrique...\nN\'oubliez pas la quantite : "20 sacs de ciment" ou "5 tonnes de sable"',
      };
    }

    if (!isConfidentMaterialMatch(matches)) {
      const topSuggestions = matches.slice(0, 3).map((match) => match.material);
      setSuggestedMaterials(topSuggestions);
      setDetectedCategory(null);
      setAlternativeMaterials([]);

      const list = topSuggestions.map((material) => material.name).join(', ');
      return {
        draftOverride: null,
        reply: `J'ai plusieurs options pour vous :\n${list}\n\nLequel exactement ?`,
      };
    }

    const selectedMaterial = matches[0].material;

    if (!quantity) {
      setPendingRecommendationMaterial(selectedMaterial);
      setSuggestedMaterials([]);
      setDetectedCategory(null);
      setAlternativeMaterials([]);
      return {
        draftOverride: null,
        reply: `Parfait ! Vous voulez du ${selectedMaterial.name}.\nQuelle quantite ? (par exemple: 20 ${selectedMaterial.unit}, 100 ${selectedMaterial.unit}...)`
      };
    }

    const recommendation = recommendSupplierForMaterial({
      context: recommendationContext,
      materialId: selectedMaterial.id,
      quantity,
      siteCoords,
      existingSiteInfo: draft?.siteInfo,
    });

    if (!recommendation) {
      return {
        draftOverride: null,
        reply:
          "Desolé, je n'ai pas trouve de fournisseur disponible pour ce materiau en ce moment.\nEssayez un autre materiau ou verifiez votre localisation.",
      };
    }

    setDraft(recommendation.draft);
    setSuggestedMaterials([]);
    setDetectedCategory(null);
    setAlternativeMaterials([]);

    return {
      draftOverride: recommendation.draft,
      reply: buildRecommendationReply({
        city: recommendationContext.city,
        materialName: selectedMaterial.name,
        recommendation,
      }),
    };
  };

  const handleSend = async (textOverride?: string | React.MouseEvent) => {
    const textToSubmit = typeof textOverride === 'string' ? textOverride : input;

    if ((!draft && !recommendationContext) || !textToSubmit.trim() || loadingReply) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      role: 'user',
      content: textToSubmit.trim(),
    };

    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setLoadingReply(true);
    setErrorMessage('');

    // Determine the current step based on draft state
    const hasAddress = !!draft?.siteInfo.address.trim();
    const hasMaterial = (draft?.cart.length ?? 0) > 0;
    const hasContactName = !!draft?.contactInfo.name.trim();
    const hasContactPhone = !!draft?.contactInfo.phone.trim();

    // Step 1: Collect address first
    if (!hasAddress && nextDraftField === 'siteAddress') {
      const validation = validateDraftFieldAnswer('siteAddress', nextUserMessage.content);
      if (validation.isValid) {
        const updatedDraft = applyDraftFieldAnswer(
          draft!,
          'siteAddress',
          validation.normalizedValue,
          recommendationContext || {} as RecommendationContext
        );
        setDraft(updatedDraft);
        const supplierChanged = updatedDraft.selectedSupplier && draft?.selectedSupplier &&
          updatedDraft.selectedSupplier.id !== draft.selectedSupplier.id;

        let reply = '';
        if (supplierChanged && updatedDraft.selectedSupplier) {
          reply = `D'accord, pour ${validation.normalizedValue}, j'ai trouve un meilleur fournisseur : **${updatedDraft.selectedSupplier.name}**. ` +
            `Le montant total est maintenant de **${updatedDraft.totalAmount.toLocaleString('fr-FR')} FCFA**. Voulez-vous continuer ?`;
        }

        await queueAssistantReply({
          nextUserMessage,
          preferredReply: reply || undefined,
          draftOverride: updatedDraft,
        });
        return;
      }
    }

    // Step 2: Material + Quantity search (only after address is collected)
    // ALWAYS try material search when no material is in cart yet
    if (hasAddress && !hasMaterial && recommendationContext) {
      const siteCoords =
        typeof draft?.siteInfo.lat === 'number' && typeof draft?.siteInfo.lng === 'number'
          ? { lat: draft.siteInfo.lat, lng: draft.siteInfo.lng }
          : null;

      const recommendationReply = handleRecommendationFlow(nextUserMessage.content, siteCoords);

      if (recommendationReply) {
        await queueAssistantReply({
          nextUserMessage,
          preferredReply: recommendationReply.reply,
          draftOverride: recommendationReply.draftOverride,
        });
        return;
      }
    }

    // If we don't have material yet and couldn't find one, keep asking for material
    if (!hasMaterial) {
      await queueAssistantReply({
        nextUserMessage,
        preferredReply: `Quel materiau souhaitez-vous commander (ex: ciment, sable, fer) ? N'oubliez pas la quantite : "20 sacs de ciment" ou "5 tonnes de sable".`,
      });
      return;
    }

    // Step 3: Contact name collection - after material is found
    if (!hasContactName) {
      // Accept any non-empty input as contact name
      if (nextUserMessage.content.trim().length >= 2) {
        const updatedDraft = {
          ...draft!,
          contactInfo: { ...draft!.contactInfo, name: nextUserMessage.content.trim() },
          createdAt: new Date().toISOString(),
        };
        setDraft(updatedDraft);
        await queueAssistantReply({
          nextUserMessage,
          preferredReply: `Merci! Quel est le numero de telephone pour joindre ${updatedDraft.contactInfo.name} ?`,
          draftOverride: updatedDraft,
        });
        return;
      }
      // Too short, ask again
      await queueAssistantReply({
        nextUserMessage,
        preferredReply: `Quel est le nom du contact pour la reception ?`,
      });
      return;
    }

    // Step 4: Contact phone collection
    if (hasContactName && !hasContactPhone) {
      const validation = validateDraftFieldAnswer('contactPhone', nextUserMessage.content);
      if (validation.isValid) {
        const updatedDraft = {
          ...draft!,
          contactInfo: { ...draft!.contactInfo, phone: validation.normalizedValue },
          createdAt: new Date().toISOString(),
        };
        setDraft(updatedDraft);
        await queueAssistantReply({
          nextUserMessage,
          preferredReply: `Parfait ! Toutes les informations sont collectees. Vous pouvez maintenant finaliser la commande.`,
          draftOverride: updatedDraft,
        });
        return;
      }
      // Invalid phone, ask again
      await queueAssistantReply({
        nextUserMessage,
        preferredReply: `Il manque encore le numero de telephone pour joindre le contact. Quel numero de telephone pour joindre ce contact ?`,
      });
      return;
    }
    await queueAssistantReply({
      nextUserMessage,
    });
  };

  const handleFinalize = async () => {
    if (!draft) {
      return;
    }

    const validationError = validateOrderDraft(draft);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setFinalizing(true);
    setErrorMessage('');

    try {
      const trackingToken = `KT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tracking_token: trackingToken,
          site_name: draft.siteInfo.name || `Livraison ${formatCityLabel(draft.siteInfo.city)}`,
          site_address: draft.siteInfo.address,
          contact_name: draft.contactInfo.name,
          contact_phone: draft.contactInfo.phone,
          supplier_id: draft.selectedSupplier?.id,
          supplier_name: draft.selectedSupplier?.name,
          total_price: draft.totalAmount,
          notes: draft.contactInfo.notes,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      const orderItems = draft.cart.map((item) => {
        const material = draft.selectedSupplier?.supplier_materials.find(
          (entry) => entry.material_id === item.materialId
        );

        return {
          order_id: order.id,
          material_id: item.materialId,
          material_name: material?.material?.name || 'Inconnu',
          quantity: item.quantity,
          unit: material?.unit || 'unite',
          unit_price: material?.price || 0,
          total_price: (material?.price || 0) * item.quantity,
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      const whatsappOrder: Order = {
        ...order,
        order_items: orderItems,
      };
      const whatsappLink = buildWhatsAppLink(generateWhatsAppMessage(whatsappOrder));

      window.open(whatsappLink, '_blank', 'noopener,noreferrer');

      await supabase.from('orders').update({ whatsapp_sent: true }).eq('id', order.id);

      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/suivi/${trackingToken}`);
    } catch (error) {
      console.error('Order finalization error', error);
      setErrorMessage('Impossible de finaliser la commande pour le moment.');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mb-6">
        <Link href="/" className="action-secondary inline-flex gap-2">
          <ArrowLeft size={16} />
          Retour a l'accueil
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel overflow-hidden">
          <div className="border-b border-kantioo-line px-6 py-6 sm:px-8">
            <span className="eyebrow">Assistant de commande</span>
            <h1 className="section-title mt-3">
              Dites nous ce dont vous avez besoin.
            </h1>
          </div>

          <div className="flex min-h-[560px] max-h-[78vh] flex-col">
            <div
              ref={conversationRef}
              className="flex-1 space-y-4 overflow-y-auto px-6 py-6 pr-3 sm:px-8"
            >
              {messages.map((message, index) => (
                <ChatBubble
                  key={`${message.role}-${index}`}
                  content={message.content}
                  role={message.role}
                />
              ))}

              {loadingReply ? (
                <div className="flex justify-start">
                  <div className="rounded-[24px] bg-kantioo-sand px-4 py-4 text-sm text-kantioo-dark">
                    <div className="flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      <span className="inline-flex items-center gap-1">
                        Votre assistant ecrit...
                        <span className="animate-pulse">.</span>
                        <span className="animate-pulse [animation-delay:180ms]">.</span>
                        <span className="animate-pulse [animation-delay:360ms]">.</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-kantioo-line px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ex: Akwa, explique le delai, manque-t-il une information ?"
                  className="min-h-[96px] flex-1 rounded-[22px] border border-kantioo-line bg-white px-4 py-4 text-sm text-kantioo-dark outline-none"
                />
                <div className="flex flex-col gap-3 sm:w-[220px]">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={(!draft && !recommendationContext) || !input.trim() || loadingReply}
                    className="action-primary gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Envoyer
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!draft || finalizing || Boolean(nextDraftField)}
                    className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white transition-all ${!nextDraftField && draft
                        ? 'bg-emerald-600 shadow-[0_18px_36px_-24px_rgba(5,150,105,0.95)] hover:-translate-y-0.5 hover:bg-emerald-700'
                        : 'bg-kantioo-muted opacity-40 cursor-not-allowed'
                      }`}
                  >
                    {finalizing ? 'Finalisation...' : 'Finaliser la commande'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="panel p-6">
            <p className="eyebrow">Commande en cours</p>
            {draft ? (
              <>
                <div className="mt-4 space-y-3 rounded-[24px] bg-kantioo-sand p-4 text-sm text-kantioo-dark">
                  <div className="flex items-center gap-3">
                    <Truck size={16} className="text-kantioo-orange" />
                    {draft.selectedSupplier?.name || 'En attente'}
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-kantioo-orange" />
                    {formatCityLabel(draft.siteInfo.city)}
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageSquare size={16} className="text-kantioo-orange" />
                    Assistant Kantioo actif
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                      Collecte en cours
                    </p>
                    <p className="mt-3 text-sm leading-7 text-kantioo-dark">
                      {nextDraftField
                        ? `Prochaine information demandee: ${getRequiredFieldLabel(nextDraftField)}.`
                        : 'Toutes les informations indispensables ont ete recueillies dans la conversation.'}
                    </p>
                    {nextDraftQuestion ? (
                      <p className="mt-2 text-sm leading-7 text-kantioo-muted">{nextDraftQuestion}</p>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                        Livraison
                      </p>
                      <p className="mt-2 text-sm leading-6 text-kantioo-dark">
                        {formatCityLabel(draft.siteInfo.city)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-kantioo-muted">
                        {draft.siteInfo.address || 'Quartier non renseigne'}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                        Contact de reception
                      </p>
                      <p className="mt-2 text-sm leading-6 text-kantioo-dark">
                        {draft.contactInfo.name || 'A renseigner dans le chat'}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-kantioo-muted">
                        {draft.contactInfo.phone || 'Numero non renseigne'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {draftLines.map((line) => (
                    <div
                      key={line.materialId}
                      className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-kantioo-dark">
                            {line.material?.material?.name || 'Materiau'}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-kantioo-muted">
                            {line.quantity} x {line.material?.unit || 'unite'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-kantioo-dark">
                          {line.lineTotal.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] bg-kantioo-dark px-5 py-4 text-white">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] opacity-70">
                    Total estime
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {draft.totalAmount.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3 rounded-[24px] bg-kantioo-sand p-4 text-sm text-kantioo-dark">
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-kantioo-orange" />
                  {formatCityLabel(recommendationContext?.city) || 'Ville non renseignee'}
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquare size={16} className="text-kantioo-orange" />
                  Analyse fournisseur en cours
                </div>
              </div>
            )}
          </div>

          {recommendationContext ? (
            <div className="panel overflow-hidden p-3 sm:p-4">
              <div className="flex items-start justify-between gap-4 px-2 pb-4 pt-2 sm:px-3">
                <div>
                  <p className="eyebrow">Carte de recommandation</p>
                  <h2 className="mt-2 text-lg font-semibold text-kantioo-dark">
                    {activeMaterial
                      ? `Fournisseurs compatibles avec ${activeMaterial.name}`
                      : 'Fournisseurs disponibles dans la ville'}
                  </h2>
                </div>
                <div className="rounded-full bg-kantioo-sand px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-kantioo-muted">
                  {compatibleSuppliers.length} visibles
                </div>
              </div>

              <div className="relative min-h-[260px] overflow-hidden rounded-[24px] bg-white sm:min-h-[300px]">
                <div className="absolute inset-x-3 top-3 z-10">
                  <div className="inline-flex max-w-[85%] rounded-full bg-white/92 px-3 py-2 text-xs font-medium text-kantioo-dark shadow-[0_18px_36px_-24px_rgba(27,19,12,0.6)] backdrop-blur">
                    {activeMaterial
                      ? 'La carte est filtree automatiquement apres comprehension du materiau.'
                      : 'La carte affichera les fournisseurs compatibles des que le materiau sera compris.'}
                  </div>
                </div>
                <SupplierMap
                  suppliers={compatibleSuppliers}
                  center={mapCenter}
                  zoom={mapZoom}
                  siteCoords={
                    typeof draft?.siteInfo.lat === 'number' && typeof draft?.siteInfo.lng === 'number'
                      ? { lat: draft.siteInfo.lat, lng: draft.siteInfo.lng }
                      : null
                  }
                />
              </div>

              <div className="grid gap-3 px-2 pb-2 pt-4 sm:px-3">
                <div className="rounded-[20px] bg-kantioo-sand px-4 py-4 text-sm leading-6 text-kantioo-dark">
                  {activeMaterial ? (
                    <span>
                      Materiau retenu: <strong>{activeMaterial.name}</strong>. L assistant compare maintenant prix, delai et proximite sur cette base.
                    </span>
                  ) : (
                    <span>
                      Ecrivez simplement le materiau et la quantite, par exemple <strong>ciment 20</strong> ou <strong>siman 30</strong>.
                    </span>
                  )}
                </div>
                {suggestedMaterials.length ? (
                  <div className="rounded-[20px] bg-white px-4 py-4 text-sm leading-6 text-kantioo-muted ring-1 ring-kantioo-line">
                    Suggestions en cours: {suggestedMaterials.map((material) => material.name).join(', ')}.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {draftValidationError ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              Informations manquantes avant finalisation: {draftValidationError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
