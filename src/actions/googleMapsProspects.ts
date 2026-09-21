"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bulkImportProspects } from "@/actions/prospects";
import { revalidatePath } from "next/cache";
import { cleanDzPhone, formatDzPhoneDisplay } from "@/lib/phoneUtils";

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
  const sector = (params.sector || "").trim();
  const limit = Math.min(params.limit || 80, 150);

  // Combined terms for targeted query
  const query = [subCat || rawQuery, rawCommune].filter(Boolean).join(" ");
  const results: GoogleMapsProspectItem[] = [];
  const seenKeys = new Set<string>();

  // 1. Google Places API (if API Key provided or in .env)
  const apiKey =
    (params.googleApiKey || "").trim() ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const gQuery = `${query || "commerce entreprise"} ${rawCommune} ${wilaya} Algerie`.trim();
      const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        gQuery
      )}&key=${apiKey}&language=fr`;

      const gRes = await fetch(gUrl, { cache: "no-store" });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.results && Array.isArray(gData.results)) {
          const topPlaces = gData.results.slice(0, Math.min(limit, 30));

          // Fetch Place Details for top results to extract phone numbers & websites
          const detailedPlaces = await Promise.all(
            topPlaces.map(async (place: any) => {
              if (!place.place_id) return place;
              try {
                const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number,formatted_address,website,rating,user_ratings_total&key=${apiKey}&language=fr`;
                const detRes = await fetch(detUrl, { cache: "no-store" });
                if (detRes.ok) {
                  const detData = await detRes.json();
                  return { ...place, ...(detData.result || {}) };
                }
              } catch {
                // Ignore individual detail error
              }
              return place;
            })
          );

          for (const place of detailedPlaces) {
            const name = place.name || "";
            if (!name) continue;
            const address = place.formatted_address || `${wilaya}, Algérie`;
            const rawPhone = place.formatted_phone_number || place.international_phone_number || "";
            const phone = cleanDzPhone(rawPhone);
            const website = place.website || undefined;
            const rating = place.rating || undefined;
            const reviewsCount = place.user_ratings_total || undefined;
            const mapsUrl = place.place_id
              ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  name + " " + wilaya
                )}`;

            const key = `${name.toLowerCase()}_${address.toLowerCase()}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push({
                id: `g_${place.place_id || Math.random().toString(36).slice(2)}`,
                companyName: name,
                phone: phone || "",
                formattedPhone: phone ? formatDzPhoneDisplay(phone) : "",
                address,
                wilaya,
                sector: sector || "Autre prestation",
                website,
                rating,
                reviewsCount,
                googleMapsUrl: mapsUrl,
                source: "Google Places API (Officiel)",
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Google Places API error:", e);
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
        `${subCat || rawQuery || "commerce entreprise"} ${rawCommune} ${wilaya} algerie`.trim(),
        `${subCat || rawQuery || "service"} ${wilaya} algerie`.trim(),
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
    const withPhoneList = filteredResults.filter((p) => p.phone && p.phone.length >= 8);
    // If user filtered by phone and we found some, apply. If none found, preserve all so the user isn't stuck with 0.
    if (withPhoneList.length > 0) {
      filteredResults = withPhoneList;
    }
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

  // Prioritize prospects with phones first
  filteredResults.sort((a, b) => {
    if (a.phone && !b.phone) return -1;
    if (!a.phone && b.phone) return 1;
    return 0;
  });

  // Attach duplicates check against Prisma DB
  const verifiedResults = await attachDuplicatesCheck(filteredResults);

  return {
    success: true,
    prospects: verifiedResults,
    totalFound: verifiedResults.length,
  };
}

// Google Maps noise words and UI action buttons to ignore
const GMAPS_NOISE_REGEX =
  /^(ouvert|fermé|ferme|ouvre|itinéraire|enregistrer|partager|site web|appeler|avis|photos|à propos|suggérer|revendiquer|sponsorisé|annonce|résultat|itinéraires|envoyer|sauvegarder)/i;

function isGmapsNoiseLine(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (l.length < 2) return true;
  if (GMAPS_NOISE_REGEX.test(l)) return true;
  if (
    l.includes("ferme à") ||
    l.includes("ouvre à") ||
    l.includes("24h/24") ||
    l.includes("· fermé") ||
    l.includes("· ouvert") ||
    l.includes("fermé temporairement") ||
    l.includes("fermé définitivement")
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

  const phoneRegex = /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-79](?:[\s.-]*\d){7,8}/;
  const ratingRegex = /(\d[.,]\d)\s*(?:\((\d+[\s\d]*)\))?/;
  const urlRegex = /https?:\/\/[^\s]+/;

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
    const hasPhone = phoneRegex.test(line);

    // If next line has rating, or previous had phone and current line has text
    const curHasPhone = cur.some((l) => phoneRegex.test(l));
    const nextLine = lines[i + 1] || "";
    const isCardBoundary =
      isSeparatingMarker ||
      (cur.length >= 2 && (ratingRegex.test(nextLine) || (curHasPhone && !hasPhone)));

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

  const knownWilayas = [
    "Alger",
    "Oran",
    "Constantine",
    "Annaba",
    "Blida",
    "Batna",
    "Sétif",
    "Béjaïa",
    "Tlemcen",
    "Biskra",
    "Boumerdès",
    "Tipaza",
    "Tizi Ouzou",
    "Chlef",
    "Mostaganem",
  ];

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const fullBlockText = block.join(" ");

    // Extract phone
    const phoneMatch = fullBlockText.match(phoneRegex);
    const rawPhone = phoneMatch ? phoneMatch[0] : "";
    const cleanPhone = cleanDzPhone(rawPhone);

    if (cleanPhone && seenPhones.has(cleanPhone)) continue;
    if (cleanPhone) seenPhones.add(cleanPhone);

    // Rating and reviews
    let rating: number | undefined;
    let reviewsCount: number | undefined;
    const ratingMatch = fullBlockText.match(ratingRegex);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1].replace(",", "."));
      if (ratingMatch[2]) {
        reviewsCount = parseInt(ratingMatch[2].replace(/\s/g, ""), 10);
      }
    }

    // Company Name: first non-rating, non-phone, non-url line
    let companyName =
      block.find(
        (l) => !ratingRegex.test(l) && !phoneRegex.test(l) && !urlRegex.test(l) && l.length > 2
      ) || "";

    companyName = companyName
      .replace(/^[\d\.\-\•\*\#\s]+/, "")
      .replace(/^Nom\s*:\s*/i, "")
      .trim();

    if (!companyName || companyName.length < 2) continue;
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
          l.length > 4
      );
      if (addressCandidate) {
        address = addressCandidate;
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
    let website: string | undefined;
    const urlMatch = fullBlockText.match(urlRegex);
    if (urlMatch && !urlMatch[0].includes("google.com/maps")) {
      website = urlMatch[0];
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
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

