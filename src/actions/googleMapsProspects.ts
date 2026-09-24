"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bulkImportProspects } from "@/actions/prospects";
import { revalidatePath } from "next/cache";
import { cleanDzPhone, formatDzPhoneDisplay, extractBestDzPhone } from "@/lib/phoneUtils";
import { WILAYAS } from "@/lib/constants";

export interface GoogleMapsProspectItem {
  id: string; // temporary client key
  companyName: string;
  phone: string;
  formattedPhone?: string;
  address?: string;
  wilaya: string;
  sector: string;
  website?: string;
  rating?: number;
  reviewsCount?: number;
  googleMapsUrl?: string;
  source: string;
  isDuplicate?: boolean;
  duplicateType?: "PROSPECT" | "CLIENT" | null;
  duplicateDetails?: string | null;
}

// Top Algerian Wilayas Bounding Boxes (minLat, minLon, maxLat, maxLon) for ultra-fast bbox queries
const WILAYA_BBOX: Record<string, [number, number, number, number]> = {
  Alger: [36.65, 2.90, 36.85, 3.30],
  Oran: [35.60, -0.75, 35.78, -0.50],
  Constantine: [36.30, 6.55, 36.45, 6.70],
  Annaba: [36.85, 7.70, 36.95, 7.80],
  Blida: [36.42, 2.78, 36.52, 2.88],
  Sétif: [36.15, 5.35, 36.25, 5.48],
  Batna: [35.50, 6.13, 35.60, 6.23],
  Béjaïa: [36.70, 5.02, 36.80, 5.12],
  Tlemcen: [34.85, -1.36, 34.92, -1.27],
  Mostaganem: [35.90, 0.05, 36.00, 0.15],
  TiziOuzou: [36.68, 4.02, 36.75, 4.10],
  "Tizi Ouzou": [36.68, 4.02, 36.75, 4.10],
  Boumerdès: [36.72, 3.44, 36.80, 3.52],
  Tipaza: [36.56, 2.40, 36.63, 2.48],
  Chlef: [36.13, 1.30, 36.20, 1.37],
  Biskra: [34.82, 5.70, 34.88, 5.76],
};

// Map keywords/amenity to CRM Sectors
function mapAmenityToSector(tags: Record<string, string>, keyword?: string): string {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const office = (tags.office || "").toLowerCase();
  const healthcare = (tags.healthcare || "").toLowerCase();
  const kw = (keyword || "").toLowerCase();

  if (
    amenity.includes("clinic") ||
    amenity.includes("hospital") ||
    amenity.includes("doctors") ||
    amenity.includes("dentist") ||
    amenity.includes("pharmacy") ||
    healthcare ||
    kw.includes("sant") ||
    kw.includes("médic") ||
    kw.includes("docteur") ||
    kw.includes("clinique")
  ) {
    return "Cabinet médical";
  }

  if (amenity.includes("hotel") || amenity.includes("guest_house") || kw.includes("hôtel") || kw.includes("hotel")) {
    return "Hôtel";
  }

  if (
    amenity.includes("restaurant") ||
    amenity.includes("fast_food") ||
    amenity.includes("cafe") ||
    kw.includes("restau") ||
    kw.includes("café") ||
    kw.includes("pizzeria")
  ) {
    return "Restaurant";
  }

  if (
    shop.includes("beauty") ||
    shop.includes("hairdresser") ||
    shop.includes("cosmetics") ||
    amenity.includes("spa") ||
    kw.includes("beaut") ||
    kw.includes("coiff") ||
    kw.includes("cosmétique")
  ) {
    return "Beauté";
  }

  if (office.includes("estate_agent") || kw.includes("immo") || kw.includes("foncier")) {
    return "Immobilier";
  }

  if (
    amenity.includes("school") ||
    amenity.includes("college") ||
    amenity.includes("university") ||
    amenity.includes("kindergarten") ||
    kw.includes("école") ||
    kw.includes("form") ||
    kw.includes("cours")
  ) {
    return "Éducation / Formation";
  }

  if (
    office.includes("company") ||
    office.includes("industrial") ||
    shop.includes("wholesale") ||
    kw.includes("grossiste") ||
    kw.includes("usine") ||
    kw.includes("fabric") ||
    kw.includes("industrie")
  ) {
    return "Industrie";
  }

  if (tags.tourism?.includes("agency") || kw.includes("voyage") || kw.includes("touris") || kw.includes("omra")) {
    return "Voyage";
  }

  if (shop) {
    return "E-commerce";
  }

  return "Autre prestation";
}

// Universal Algerian phone regex matching landlines (021, 023, 025, 031, etc.) and mobiles (05, 06, 07)
const DZ_PHONE_REGEX = /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-79](?:[\s.-]*\d){7,8}/g;

export interface GoogleMapsSearchParams {
  query: string;
  wilaya?: string;
  commune?: string;
  sector?: string;
  subCategory?: string;
  onlyWithPhone?: boolean;
  onlyWithoutWebsite?: boolean;
  onlyWithWebsite?: boolean;
  minRating?: number;
  minReviews?: number;
  limit?: number;
  googleApiKey?: string;
}

/**
 * Check a list of items for duplicates in Prisma against both Prospect and Client tables
 */
export async function attachDuplicatesCheck(items: GoogleMapsProspectItem[]): Promise<GoogleMapsProspectItem[]> {
  if (items.length === 0) return items;

  // Pre-load all prospect & client phones & company names
  const [existingProspects, existingClients] = await Promise.all([
    prisma.prospect.findMany({
      select: {
        id: true,
        phone: true,
        companyName: true,
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.client.findMany({
      select: {
        id: true,
        phone: true,
        companyName: true,
      },
    }),
  ]);

  const phoneToProspect = new Map<string, { companyName: string; assignedTo?: string }>();
  const compToProspect = new Map<string, { companyName: string; assignedTo?: string }>();

  for (const p of existingProspects) {
    const cleanP = cleanDzPhone(p.phone);
    if (cleanP) {
      phoneToProspect.set(cleanP, {
        companyName: p.companyName,
        assignedTo: p.assignedTo?.name || "Non assigné",
      });
    }
    const cleanComp = p.companyName.trim().toLowerCase();
    if (cleanComp) {
      compToProspect.set(cleanComp, {
        companyName: p.companyName,
        assignedTo: p.assignedTo?.name || "Non assigné",
      });
    }
  }

  const phoneToClient = new Map<string, string>();
  const compToClient = new Map<string, string>();

  for (const c of existingClients) {
    const cleanP = cleanDzPhone(c.phone);
    if (cleanP) {
      phoneToClient.set(cleanP, c.companyName);
    }
    const cleanComp = c.companyName.trim().toLowerCase();
    if (cleanComp) {
      compToClient.set(cleanComp, c.companyName);
    }
  }

  return items.map((item) => {
    const pClean = cleanDzPhone(item.phone);
    const cClean = item.companyName.trim().toLowerCase();

    // Check Client first
    if (pClean && phoneToClient.has(pClean)) {
      return {
        ...item,
        isDuplicate: true,
        duplicateType: "CLIENT",
        duplicateDetails: `Déjà client dans le CRM : "${phoneToClient.get(pClean)}"`,
      };
    }
    if (cClean && compToClient.has(cClean)) {
      return {
        ...item,
        isDuplicate: true,
        duplicateType: "CLIENT",
        duplicateDetails: `Déjà client dans le CRM : "${compToClient.get(cClean)}"`,
      };
    }

    // Check Prospect
    if (pClean && phoneToProspect.has(pClean)) {
      const match = phoneToProspect.get(pClean)!;
      return {
        ...item,
        isDuplicate: true,
        duplicateType: "PROSPECT",
        duplicateDetails: `Déjà prospect : "${match.companyName}" (${match.assignedTo})`,
      };
    }
    if (cClean && compToProspect.has(cClean)) {
      const match = compToProspect.get(cClean)!;
      return {
        ...item,
        isDuplicate: true,
        duplicateType: "PROSPECT",
        duplicateDetails: `Déjà prospect : "${match.companyName}" (${match.assignedTo})`,
      };
    }

    return {
      ...item,
      isDuplicate: false,
      duplicateType: null,
      duplicateDetails: null,
    };
  });
}

/**
 * Server Action to check duplicates for imported/uploaded items
 */
export async function checkProspectsDuplicatesAction(items: GoogleMapsProspectItem[]) {
  await requireAuth();
  return attachDuplicatesCheck(items);
}

const SECTOR_SEARCH_QUERIES: Record<string, string> = {
  "Cabinet médical": "clinique médicale santé docteur hôpital laboratoire pharmacie",
  "Industrie": "grossiste usine industrie distribution importateur négoce",
  "Immobilier": "agence immobiliere promoteur immobilier batiment",
  "Hôtel": "hotel résidence touristique hébergement",
  "Restaurant": "restaurant café pizzeria salon de thé traiteur",
  "Beauté": "salon de coiffure institut beauté cosmétique spa",
  "Éducation / Formation": "école privée centre formation cours crèche",
  "Voyage": "agence voyage omra tourisme billets",
  "E-commerce": "boutique showroom magasin électroménager meuble",
  "Autre prestation": "entreprise prestation société service",
};

// High-performance sector query terms tailored specifically for Algerian Google Maps listings
const SECTOR_GOOGLE_QUERIES: Record<string, string[]> = {
  "Cabinet médical": [
    "clinique médicale cabinet médical docteur",
    "médecin spécialiste cabinet centre médical",
    "laboratoire d'analyses médicales radiologie",
  ],
  "Industrie": [
    "grossiste distribution usine importation",
    "fournisseur négoce vente en gros",
    "société industrielle fabrication matériel",
  ],
  "Immobilier": [
    "agence immobilière promotion immobilière",
    "promoteur immobilier bureau d'études",
    "entreprise bâtiment BTP construction",
  ],
  "Hôtel": [
    "hôtel",
    "résidence touristique complexe hôtelier",
  ],
  "Restaurant": [
    "restaurant café pizzeria",
    "salon de thé fast food traiteur",
  ],
  "Beauté": [
    "salon de coiffure institut de beauté",
    "centre esthétique spa bien-être",
    "parfumerie cosmétique",
  ],
  "Éducation / Formation": [
    "école privée",
    "centre de formation professionnelle institut",
    "crèche école primaire",
  ],
  "Voyage": [
    "agence de voyage omra tourisme",
    "billetterie voyages visas",
  ],
  "E-commerce": [
    "magasin showroom boutique",
    "vente électroménager meubles",
  ],
  "Autre prestation": [
    "société entreprise service",
    "cabinet bureau conseil prestation",
  ],
};

function parseGooglePlacesError(errorMsg: string, rawStatus?: string): string {
  const lower = (errorMsg || "").toLowerCase();
  const statusLower = (rawStatus || "").toLowerCase();

  if (lower.includes("billing") || lower.includes("billable") || statusLower.includes("billing")) {
    return "Facturation Google Cloud non activée : Google offre 200 $/mois (~40 000 requêtes gratuites), mais impose d'associer un compte de facturation (Billing) sur console.cloud.google.com/billing.";
  }
  if (
    lower.includes("not authorized") ||
    lower.includes("has not been used") ||
    lower.includes("disabled") ||
    lower.includes("permission_denied") ||
    statusLower.includes("permission_denied")
  ) {
    return "L'API Google Places n'est pas encore activée sur votre projet Google Cloud. Rendez-vous sur Google Cloud Console > 'API & Services' > 'Bibliothèque' et activez 'Places API' (ou 'Places API (New)').";
  }
  if (lower.includes("referer") || lower.includes("ip") || lower.includes("unauthenticated")) {
    return "Restriction de clé bloquante : Si votre clé est restreinte par 'Référents HTTP', modifiez la restriction dans Google Cloud > Identifiants sur 'Adresses IP' ou 'Aucune' pour autoriser les requêtes du serveur CRM.";
  }
  if (
    lower.includes("api key not valid") ||
    lower.includes("invalid") ||
    lower.includes("credentials_missing") ||
    statusLower.includes("invalid_argument")
  ) {
    return "Clé API Google non valide pour Places API. Attention : les clés Google Gemini (commençant par AQ.) ne fonctionnent pas pour Maps. Utilisez une clé Google Cloud Console (commençant par AIzaSy...) avec Places API activée.";
  }
  if (lower.includes("over_query_limit") || lower.includes("quota")) {
    return "Quota Google Places dépassé ou limite temporaire atteinte pour cette clé.";
  }
  return errorMsg || rawStatus || "Erreur de configuration Google Places API.";
}

/**
 * Diagnostic Action: Test Google Maps API Key in real-time
 */
export async function testGoogleMapsApiKeyAction(apiKey: string): Promise<{
  success: boolean;
  message: string;
  apiType?: "NEW" | "LEGACY";
  errorDetails?: string;
}> {
  await requireAuth();
  const key = (apiKey || "").trim();
  if (!key) {
    return { success: false, message: "Veuillez saisir une clé API Google." };
  }

  if (key.startsWith("AQ.")) {
    return {
      success: false,
      message: "Clé non compatible (Google Gemini)",
      errorDetails:
        "La clé saisie commence par 'AQ.', ce qui correspond à une clé Google Gemini (IA Studio). Pour importer depuis Google Maps, vous devez créer une clé Google Cloud Console avec l'API 'Places API' (commençant généralement par 'AIzaSy...').",
    };
  }

  // 1. Try Places API (New)
  try {
    const resNew = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: "Pharmacie Alger",
        languageCode: "fr",
        maxResultCount: 2,
      }),
      cache: "no-store",
    });

    const dataNew = await resNew.json();
    if (resNew.ok && dataNew.places && Array.isArray(dataNew.places) && dataNew.places.length > 0) {
      return {
        success: true,
        message: "Clé Google Places (Places API New) connectée et 100% opérationnelle !",
        apiType: "NEW",
      };
    }
  } catch {}

  // 2. Try Places API (Legacy)
  try {
    const resLeg = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Pharmacie+Alger&key=${key}&language=fr`,
      { cache: "no-store" }
    );
    const dataLeg = await resLeg.json();
    if (dataLeg.status === "OK" || dataLeg.status === "ZERO_RESULTS") {
      return {
        success: true,
        message: "Clé Google Places (Places API Legacy) connectée et 100% opérationnelle !",
        apiType: "LEGACY",
      };
    } else {
      const parsed = parseGooglePlacesError(dataLeg.error_message || "", dataLeg.status);
      return {
        success: false,
        message: `Erreur Google Cloud : ${dataLeg.status || "Échec"}`,
        errorDetails: parsed,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur de connexion au serveur Google",
      errorDetails: err?.message || "Impossible de joindre Google Places.",
    };
  }
}

/**
 * Robust Dual-Engine Google Places fetcher (New + Legacy) with multi-query support
 */
async function fetchFromGooglePlaces({
  apiKey,
  queries,
  limit,
  wilaya,
  sector,
}: {
  apiKey: string;
  queries: string[];
  limit: number;
  wilaya: string;
  sector: string;
}): Promise<{
  items: GoogleMapsProspectItem[];
  error?: string;
  apiType?: "NEW" | "LEGACY";
}> {
  const cleanKey = apiKey.trim();
  if (cleanKey.startsWith("AQ.")) {
    return {
      items: [],
      error:
        "La clé commence par 'AQ.' (clé Google Gemini IA). Pour Google Maps, il faut une clé Google Cloud 'Places API' (commençant par 'AIzaSy...').",
    };
  }

  const items: GoogleMapsProspectItem[] = [];
  const seenPlaceKeys = new Set<string>();
  let lastError = "";

  for (const q of queries) {
    if (items.length >= limit) break;

    let successWithNew = false;

    // 1. Try Places API (New) - single round-trip with full fields
    try {
      const resNew = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": cleanKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery: q,
          languageCode: "fr",
          maxResultCount: Math.min(20, limit - items.length),
        }),
        cache: "no-store",
      });

      if (resNew.ok) {
        const dataNew = await resNew.json();
        if (dataNew.places && Array.isArray(dataNew.places)) {
          successWithNew = true;
          for (const p of dataNew.places) {
            const name = p.displayName?.text || "";
            if (!name) continue;
            const rawPhone = p.nationalPhoneNumber || p.internationalPhoneNumber || "";
            const phone = cleanDzPhone(rawPhone);
            const address = p.formattedAddress || `${wilaya}, Algérie`;
            const dedupeKey = `${name.toLowerCase()}_${phone || address.toLowerCase()}`;
            if (seenPlaceKeys.has(dedupeKey)) continue;
            seenPlaceKeys.add(dedupeKey);

            items.push({
              id: `g_${p.id || Math.random().toString(36).slice(2)}`,
              companyName: name,
              phone: phone || "",
              formattedPhone: phone ? formatDzPhoneDisplay(phone) : "",
              address,
              wilaya,
              sector: sector || "Autre prestation",
              website: p.websiteUri || undefined,
              rating: typeof p.rating === "number" ? p.rating : undefined,
              reviewsCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
              googleMapsUrl:
                p.googleMapsUri ||
                `https://www.google.com/maps/place/?q=place_id:${p.id || ""}`,
              source: "Google Places API (Officiel)",
            });
          }
        }
      } else {
        const errJson = await resNew.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || resNew.statusText;
        lastError = parseGooglePlacesError(errMsg, errJson?.error?.status);
      }
    } catch (e: any) {
      // Ignore network error and attempt legacy
    }

    // 2. If Places API New didn't work, try Legacy TextSearch
    if (!successWithNew && items.length === 0) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          q
        )}&key=${cleanKey}&language=fr`;
        const gRes = await fetch(gUrl, { cache: "no-store" });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && Array.isArray(gData.results)) {
            const topPlaces = gData.results.slice(0, Math.min(20, limit - items.length));
            // Fetch Place Details for top results to extract phone numbers & websites
            const detailedPlaces = await Promise.all(
              topPlaces.map(async (place: any) => {
                if (!place.place_id) return place;
                try {
                  const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number,formatted_address,website,rating,user_ratings_total&key=${cleanKey}&language=fr`;
                  const detRes = await fetch(detUrl, { cache: "no-store" });
                  if (detRes.ok) {
                    const detData = await detRes.json();
                    return { ...place, ...(detData.result || {}) };
                  }
                } catch {}
                return place;
              })
            );

            for (const place of detailedPlaces) {
              const name = place.name || "";
              if (!name) continue;
              const address = place.formatted_address || `${wilaya}, Algérie`;
              const rawPhone =
                place.formatted_phone_number || place.international_phone_number || "";
              const phone = cleanDzPhone(rawPhone);
              const dedupeKey = `${name.toLowerCase()}_${phone || address.toLowerCase()}`;
              if (seenPlaceKeys.has(dedupeKey)) continue;
              seenPlaceKeys.add(dedupeKey);

              items.push({
                id: `g_${place.place_id || Math.random().toString(36).slice(2)}`,
                companyName: name,
                phone: phone || "",
                formattedPhone: phone ? formatDzPhoneDisplay(phone) : "",
                address,
                wilaya,
                sector: sector || "Autre prestation",
                website: place.website || undefined,
                rating: place.rating || undefined,
                reviewsCount: place.user_ratings_total || undefined,
                googleMapsUrl: place.place_id
                  ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      name + " " + wilaya
                    )}`,
                source: "Google Places API (Officiel)",
              });
            }
          } else if (gData.status !== "OK" && gData.status !== "ZERO_RESULTS") {
            lastError = parseGooglePlacesError(gData.error_message || "", gData.status);
          }
        }
      } catch (e: any) {
        lastError = e?.message || "Erreur de requête Google Places Legacy.";
      }
    }
  }

  return {
    items,
    error: items.length === 0 && lastError ? lastError : undefined,
  };
}

/**
 * Live Search Google Maps / Algerian Business Directory via Google Places API + Overpass OSM + Nominatim
 */
export async function searchGoogleMapsProspectsAction(params: GoogleMapsSearchParams) {
  await requireAuth();

  const rawQuery = (params.query || "").trim();
  const subCat = (params.subCategory || "").trim();
  const rawCommune =
    params.commune && params.commune !== "Toutes les communes"
      ? params.commune.replace(/\s*\(.*\)/, "").trim()
      : "";
  const wilaya = (params.wilaya || "Alger").trim();
  const sector = (params.sector || "Cabinet médical").trim();
  const limit = Math.min(params.limit || 80, 150);

  // In direct sector mode: subCat > rawQuery > sector keywords fallback
  const sectorFallback = sector ? (SECTOR_SEARCH_QUERIES[sector] || sector) : "commerce entreprise";
  const effectiveTerm = subCat || rawQuery || sectorFallback;
  const query = [effectiveTerm, rawCommune].filter(Boolean).join(" ");
  const results: GoogleMapsProspectItem[] = [];
  const seenKeys = new Set<string>();

  let googleApiStatus: {
    used: boolean;
    success: boolean;
    placesCount: number;
    error?: string;
    warning?: string;
  } | undefined;

  // 1. Google Places API (if API Key provided or in .env)
  const apiKey =
    (params.googleApiKey || "").trim() ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "";

  if (apiKey) {
    const queries: string[] = [];
    const cleanCommune = rawCommune ? rawCommune.replace(/\s*\(.*\)/, "").trim() : "";

    if (rawQuery) {
      queries.push([rawQuery, cleanCommune, wilaya, "Algerie"].filter(Boolean).join(" "));
    } else if (subCat) {
      queries.push([subCat, cleanCommune, wilaya, "Algerie"].filter(Boolean).join(" "));
    } else {
      const sectorQueries = SECTOR_GOOGLE_QUERIES[sector] || [sector || "commerce"];
      for (const sq of sectorQueries.slice(0, 2)) {
        queries.push([sq, cleanCommune, wilaya, "Algerie"].filter(Boolean).join(" "));
      }
    }

    const gResult = await fetchFromGooglePlaces({
      apiKey,
      queries,
      limit,
      wilaya,
      sector,
    });

    if (gResult.items.length > 0) {
      for (const item of gResult.items) {
        const key = `${item.companyName.toLowerCase()}_${(item.phone || item.address || "").toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(item);
        }
      }
      googleApiStatus = {
        used: true,
        success: true,
        placesCount: gResult.items.length,
      };
    } else if (gResult.error) {
      googleApiStatus = {
        used: true,
        success: false,
        placesCount: 0,
        error: gResult.error,
      };
    }
  }

  // 2. Overpass OSM Query (Algerian business tags with safety timeout)
  if (results.length < limit) {
    try {
      const bbox = WILAYA_BBOX[wilaya];
      let overpassQuery = "";

      if (bbox) {
        const [minLat, minLon, maxLat, maxLon] = bbox;
        overpassQuery = `
          [out:json][timeout:8];
          (
            node["amenity"](${minLat},${minLon},${maxLat},${maxLon});
            node["shop"](${minLat},${minLon},${maxLat},${maxLon});
            node["office"](${minLat},${minLon},${maxLat},${maxLon});
            node["craft"](${minLat},${minLon},${maxLat},${maxLon});
            node["healthcare"](${minLat},${minLon},${maxLat},${maxLon});
            node["tourism"](${minLat},${minLon},${maxLat},${maxLon});
            way["amenity"](${minLat},${minLon},${maxLat},${maxLon});
            way["shop"](${minLat},${minLon},${maxLat},${maxLon});
            way["office"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out center ${limit * 2};
        `;
      } else {
        overpassQuery = `
          [out:json][timeout:8];
          area["ISO3166-1"="DZ"]->.dz;
          area["name"~"${wilaya}",i](area.dz)->.searchArea;
          (
            node["amenity"](area.searchArea);
            node["shop"](area.searchArea);
            node["office"](area.searchArea);
          );
          out center ${limit * 2};
        `;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);

      const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(overpassQuery),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (overpassRes.ok) {
        const opData = await overpassRes.json();
        if (opData.elements && Array.isArray(opData.elements)) {
          for (const el of opData.elements) {
            const tags = el.tags || {};
            const name =
              tags["name:fr"] ||
              tags.name ||
              tags["name:en"] ||
              tags["alt_name:fr"] ||
              tags.alt_name;
            if (!name) continue;

            const fullTagStr = `${name} ${tags.amenity || ""} ${tags.shop || ""} ${
              tags.office || ""
            } ${tags.craft || ""} ${tags.healthcare || ""} ${tags["addr:street"] || ""} ${
              tags["addr:city"] || ""
            }`.toLowerCase();

            if (rawQuery || subCat) {
              const termsToMatch = (subCat || rawQuery).toLowerCase().split(" ");
              const matchesQuery = termsToMatch.some(
                (term) => term.length > 2 && fullTagStr.includes(term)
              );
              if (!matchesQuery) continue;
            } else if (sector && sector !== "Autre prestation") {
              const mappedSec = mapAmenityToSector(tags, "");
              if (mappedSec !== sector) {
                const sectorKeywords = (SECTOR_SEARCH_QUERIES[sector] || "").toLowerCase().split(" ").filter((w) => w.length > 3);
                const hasMatch = sectorKeywords.some((kw) => fullTagStr.includes(kw));
                if (!hasMatch) continue;
              }
            }

            if (rawCommune) {
              const matchesCommune = fullTagStr.includes(rawCommune.toLowerCase());
              if (!matchesCommune) continue;
            }

            const rawPhone =
              tags.phone ||
              tags["contact:phone"] ||
              tags["contact:mobile"] ||
              tags["phone:mobile"] ||
              tags["tel"] ||
              "";
            const phone = cleanDzPhone(rawPhone);
            const street = tags["addr:street"] || tags["addr:full"] || "";
            const city = rawCommune || tags["addr:city"] || tags["addr:city:fr"] || wilaya;
            const address = [street, city].filter(Boolean).join(", ");
            const website =
              tags.website || tags["contact:website"] || tags["brand:website"] || "";
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            const mapsUrl =
              lat && lon
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    name + " " + wilaya
                  )}`;

            const determinedSector = sector || mapAmenityToSector(tags, query);
            const dedupeKey = `${name.toLowerCase()}_${phone || address.toLowerCase()}`;

            if (!seenKeys.has(dedupeKey)) {
              seenKeys.add(dedupeKey);
              results.push({
                id: `osm_${el.id}`,
                companyName: name,
                phone: phone || "",
                formattedPhone: phone ? formatDzPhoneDisplay(phone) : "",
                address: address || `${city}, Algérie`,
                wilaya: city || wilaya,
                sector: determinedSector,
                website: website || undefined,
                googleMapsUrl: mapsUrl,
                source: "Google Maps / Annuaire DZ",
              });
            }

            if (results.length >= limit) break;
          }
        }
      }
    } catch (e) {
      console.warn("Overpass OSM search notice:", e);
    }
  }

  // 3. Nominatim fallback with multiple search queries
  if (results.length < 15) {
    try {
      const searchTerms = [
        `${subCat || sector || "commerce entreprise"} ${rawCommune} ${wilaya} algerie`.trim(),
        `${subCat || rawQuery || sectorFallback.split(" ").slice(0, 3).join(" ")} ${rawCommune} ${wilaya} algerie`.trim(),
      ];

      for (const st of searchTerms) {
        if (results.length >= limit) break;
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          st
        )}&format=json&addressdetails=1&extratags=1&limit=${Math.min(limit, 40)}`;

        const nomRes = await fetch(nomUrl, {
          headers: { "User-Agent": "BoosterA-CRM-DZ/1.0 (contact@boostera.dz)" },
          cache: "no-store",
        });

        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData)) {
            for (const item of nomData) {
              const name = item.name || item.display_name?.split(",")[0];
              if (!name) continue;

              const extra = item.extratags || {};
              const rawPhone =
                extra.phone || extra["contact:phone"] || extra["contact:mobile"] || "";
              const phone = cleanDzPhone(rawPhone);
              const website = extra.website || extra["contact:website"] || "";
              const address = item.display_name || "";
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`;

              const dedupeKey = `${name.toLowerCase()}_${phone || address.toLowerCase()}`;
              if (!seenKeys.has(dedupeKey)) {
                seenKeys.add(dedupeKey);
                results.push({
                  id: `nom_${item.place_id}`,
                  companyName: name,
                  phone: phone || "",
                  formattedPhone: phone ? formatDzPhoneDisplay(phone) : "",
                  address,
                  wilaya: rawCommune || item.address?.state || wilaya,
                  sector: sector || mapAmenityToSector(extra, query),
                  website: website || undefined,
                  googleMapsUrl: mapsUrl,
                  source: "Google Maps Direct",
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Nominatim fallback notice:", e);
    }
  }

  // 4. Apply Filters
  let filteredResults = results;

  if (params.onlyWithPhone) {
    filteredResults = filteredResults.filter((p) => p.phone && p.phone.length >= 8);
  }

  if (params.onlyWithoutWebsite) {
    filteredResults = filteredResults.filter((p) => !p.website);
  }

  if (params.onlyWithWebsite) {
    filteredResults = filteredResults.filter((p) => Boolean(p.website));
  }

  if (params.minRating && params.minRating > 0) {
    filteredResults = filteredResults.filter(
      (p) => typeof p.rating === "number" && p.rating >= (params.minRating || 0)
    );
  }

  if (params.minReviews && params.minReviews > 0) {
    filteredResults = filteredResults.filter(
      (p) => typeof p.reviewsCount === "number" && p.reviewsCount >= (params.minReviews || 0)
    );
  }

  // Ne pas modifier l'ordre de la liste automatiquement : conserver l'ordre naturel des résultats Google Maps

  // Attach duplicates check against Prisma DB
  const verifiedResults = await attachDuplicatesCheck(filteredResults);

  return {
    success: true,
    prospects: verifiedResults,
    totalFound: verifiedResults.length,
    googleApiStatus,
  };
}

// Google Maps noise words and UI action buttons to ignore
const GMAPS_NOISE_REGEX =
  /^(itinéraire|itinéraires|enregistrer|partager|site web|appeler|avis|photos|à propos|suggérer|revendiquer|sponsorisé|annonce|résultat|résultats|envoyer|sauvegarder|menu|aperçu|explorer|plus de filtres|trier par|rechercher|dans cette zone|rechercher dans cette zone|contributeur|étoiles|note|enregistré|récents|obtenir l'appli|vous êtes arrivé|mettre à jour|haut de page|calques|chargement)/i;

function isGmapsNoiseLine(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (l.length < 2) return true;
  // If line contains an Algerian phone number, it is NEVER noise!
  if (extractBestDzPhone(line)) return false;
  if (line.trim().startsWith('"')) return true; // Review quotes
  if (GMAPS_NOISE_REGEX.test(l)) return true;
  if (
    l.includes("ferme à") ||
    l.includes("ouvre à") ||
    l.includes("24h/24") ||
    l.includes("· fermé") ||
    l.includes("· ouvert") ||
    l.includes("fermé temporairement") ||
    l.includes("fermé définitivement") ||
    l.includes("mise à jour il y a") ||
    l.includes("avis google") ||
    l.includes("partager cette fiche") ||
    l.includes("vous êtes arrivé à la fin") ||
    l.includes("mettre à jour les résultats") ||
    l.includes("haut de page") ||
    l.includes("chargement en cours")
  ) {
    return true;
  }
  return false;
}

/**
 * Smart Parser: Extracts business listings copied directly from Google Maps (web or app),
 * single place views, share links, or plain text with Algerian phone numbers.
 */
export async function parseGoogleMapsTextAction(params: {
  rawText: string;
  defaultWilaya?: string;
  defaultSector?: string;
}) {
  await requireAuth();

  const { rawText, defaultWilaya = "Alger", defaultSector = "Cabinet médical" } = params;
  if (!rawText || !rawText.trim()) {
    return { success: true, prospects: [] };
  }

  const phoneRegex = /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-79](?:[\s./-]*\d){7,8}/;
  const ratingRegex = /(\d[.,]\d)\s*(?:\((\d+[\s\d]*)\))?/;
  const urlRegex = /https?:\/\/[^\s\)]+/;

  // Filter out noise lines
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isGmapsNoiseLine(l));

  // Chunk lines into business blocks
  const blocks: string[][] = [];
  let cur: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSeparatingMarker = line === "---" || line === "***" || line.startsWith("===");
    const isMarkdownPlaceLink = line.startsWith("[") && line.includes("](");
    const isSiteWebLink = line.toLowerCase().startsWith("[site web]");
    const hasPhone = Boolean(extractBestDzPhone(line));

    // If markdown place link, or next line has rating, or card boundary
    const curHasPhone = cur.some((l) => Boolean(extractBestDzPhone(l)));
    const nextLine = lines[i + 1] || "";
    const isCardBoundary =
      isSeparatingMarker ||
      (isMarkdownPlaceLink && !isSiteWebLink && cur.length > 0) ||
      (cur.length >= 2 && (ratingRegex.test(nextLine) || (curHasPhone && !hasPhone && !nextLine.startsWith("http"))));

    if (isCardBoundary) {
      if (cur.length > 0) blocks.push(cur);
      cur = isSeparatingMarker ? [] : [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length > 0) blocks.push(cur);

  const prospects: GoogleMapsProspectItem[] = [];
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();

  const knownWilayas = Array.from(new Set([...WILAYAS, "Alger", "Oran", "Constantine", "Annaba", "Blida", "Sétif", "Batna", "Béjaïa", "Tlemcen", "Biskra", "Boumerdès", "Tipaza", "Tizi Ouzou", "Chlef", "Mostaganem"]));

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const fullBlockText = block.join(" ");

    // Extract phone cleanly with our multi-pattern extractor
    const cleanPhone = extractBestDzPhone(fullBlockText);

    if (cleanPhone && seenPhones.has(cleanPhone)) continue;
    if (cleanPhone) seenPhones.add(cleanPhone);

    // Rating and reviews (strip URLs first so coordinates like !3d36.757 are not mistaken for ratings)
    let rating: number | undefined;
    let reviewsCount: number | undefined;
    const textWithoutUrls = fullBlockText.replace(/https?:\/\/[^\s\)]+/g, "");
    const ratingMatch = textWithoutUrls.match(ratingRegex);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1].replace(",", "."));
      if (ratingMatch[2]) {
        reviewsCount = parseInt(ratingMatch[2].replace(/\s/g, ""), 10);
      }
    }

    // Company Name, Google Maps URL & Website from Markdown links if present
    let companyName = "";
    let placeMapsUrl = "";
    let extractedWebsite: string | undefined;

    for (const l of block) {
      const mdMatch = l.match(/\[(.*?)\]\((.*?)\)/);
      if (mdMatch) {
        if (/site web/i.test(mdMatch[1])) {
          extractedWebsite = mdMatch[2];
        } else if (!companyName) {
          companyName = mdMatch[1].trim();
          placeMapsUrl = mdMatch[2].trim();
        }
      }
    }

    if (!companyName) {
      companyName =
        block.find(
          (l) => !ratingRegex.test(l) && !extractBestDzPhone(l) && !urlRegex.test(l) && l.length > 2
        ) || "";
    }

    companyName = companyName
      .replace(/^[\d\.\-\•\*\#\s]+/, "")
      .replace(/^Nom\s*:\s*/i, "")
      .trim();

    if (!companyName || companyName.length < 2 || companyName === "2") continue;
    const lowerName = companyName.toLowerCase();
    if (seenNames.has(lowerName)) continue;
    seenNames.add(lowerName);

    // Address & Wilaya
    let address = "";
    let detectedWilaya = defaultWilaya;

    // Check if any line specifies Address explicitly
    const explicitAddr = block.find((l) => /^Adresse\s*:\s*/i.test(l));
    if (explicitAddr) {
      address = explicitAddr.replace(/^Adresse\s*:\s*/i, "").trim();
    } else {
      const addressCandidate = block.find(
        (l) =>
          l !== companyName &&
          !ratingRegex.test(l) &&
          !phoneRegex.test(l) &&
          !urlRegex.test(l) &&
          !l.startsWith("[") &&
          l.length > 4
      );
      if (addressCandidate) {
        address = addressCandidate;
      } else if (cleanPhone) {
        // Line with phone might contain the address (e.g. "Dely Ibrahim · 023 37 80 00")
        const lineWithPhone = block.find((l) => phoneRegex.test(l));
        if (lineWithPhone) {
          const rawMatch = lineWithPhone.match(phoneRegex);
          const toRemove = rawMatch ? rawMatch[0] : cleanPhone;
          const cleanedAddr = lineWithPhone
            .replace(toRemove, "")
            .replace(/^[·•\-\|\,\s]+|[·•\-\|\,\s]+$/g, "")
            .replace(/^tél(?:éphone)?\s*[:.]?\s*/i, "")
            .trim();
          if (cleanedAddr.length > 2 && cleanedAddr !== companyName) {
            address = cleanedAddr;
          }
        }
      }
    }

    // Detect wilaya inside address
    for (const w of knownWilayas) {
      if (address.toLowerCase().includes(w.toLowerCase())) {
        detectedWilaya = w;
        break;
      }
    }

    // Website
    const urlMatch = fullBlockText.match(urlRegex);
    const website =
      extractedWebsite ||
      (urlMatch && !urlMatch[0].includes("google.com/maps") ? urlMatch[0] : undefined);

    const mapsUrl =
      placeMapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        companyName + " " + detectedWilaya
      )}`;

    prospects.push({
      id: `pasted_${b}_${Math.random().toString(36).slice(2, 7)}`,
      companyName,
      phone: cleanPhone,
      formattedPhone: cleanPhone ? formatDzPhoneDisplay(cleanPhone) : "",
      address: address || `${detectedWilaya}, Algérie`,
      wilaya: detectedWilaya,
      sector: defaultSector,
      rating,
      reviewsCount,
      website,
      googleMapsUrl: mapsUrl,
      source: "Google Maps Copier-Coller",
    });
  }

  const verified = await attachDuplicatesCheck(prospects);

  return {
    success: true,
    prospects: verified,
  };
}

/**
 * 1-Click Batch Import selected Google Maps prospects into the CRM pipeline
 */
export async function importGoogleMapsProspectsAction(params: {
  prospects: GoogleMapsProspectItem[];
  assignedToId?: string;
  assignedUserIds?: string[];
  campaignTag?: string;
  defaultSector?: string;
  defaultWilaya?: string;
}) {
  const user = await requireAuth();
  const { prospects, assignedToId, assignedUserIds, campaignTag } = params;

  if (!prospects || prospects.length === 0) {
    return { success: false, error: "Aucun prospect à importer." };
  }

  const useRoundRobin = Boolean(assignedUserIds && assignedUserIds.length > 0);

  // Format rows for bulkImportProspects
  const rows = prospects.map((p, index) => {
    let resolvedAssignee = assignedToId || user.id;
    if (useRoundRobin && assignedUserIds && assignedUserIds.length > 0) {
      resolvedAssignee = assignedUserIds[index % assignedUserIds.length];
    }

    let notes = `Source: ${p.source || "Google Maps"}`;
    if (campaignTag && campaignTag.trim()) {
      notes += ` | Campagne: ${campaignTag.trim()}`;
    }
    if (p.rating) {
      notes += ` | Note: ${p.rating}/5 (${p.reviewsCount || 0} avis)`;
    }
    if (p.website) {
      notes += ` | Site: ${p.website}`;
    }
    if (p.googleMapsUrl) {
      notes += ` | Maps: ${p.googleMapsUrl}`;
    }

    return {
      companyName: p.companyName.trim(),
      phone: p.phone ? cleanDzPhone(p.phone) : "0000000000",
      sector: p.sector || params.defaultSector || "Autre prestation",
      wilaya: p.wilaya || params.defaultWilaya || "Alger",
      address: p.address || undefined,
      notes,
      assignedToId: resolvedAssignee,
    };
  });

  const res = await bulkImportProspects(rows, assignedToId || user.id, {
    importAsVirgin: true,
  });

  revalidatePath("/direction/google-maps");
  revalidatePath("/base-prospects");
  revalidatePath("/prospection");
  revalidatePath("/dashboard");

  return {
    success: true,
    imported: res.imported || 0,
    duplicatesCount: res.skippedDuplicates || 0,
    invalidCount: res.skippedInvalid || 0,
  };
}

