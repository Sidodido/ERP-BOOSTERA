"use client";

import React, { useState, useTransition } from "react";
import {
  Boxes,
  Plus,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  X,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  createAssetAction,
  updateAssetAction,
  createInventoryItemAction,
  recordStockMovementAction,
} from "@/actions/stocks";
import { AssetStatus, StockMovementType } from "@prisma/client";

interface AssetItem {
  id: string;
  name: string;
  serialNumber?: string | null;
  category: string;
  price: number;
  status: AssetStatus;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
}

interface InventoryItemData {
  id: string;
  name: string;
  sku?: string | null;
  quantityInStock: number;
  minThreshold: number;
  unitPrice: number;
  movements: {
    id: string;
    type: StockMovementType;
    quantity: number;
    reason?: string | null;
    createdAt: Date | string;
  }[];
}

interface StocksClientProps {
  assets: AssetItem[];
  inventoryItems: InventoryItemData[];
  users: { id: string; name: string; role: string }[];
  kpis: {
    totalAssetsCount: number;
    totalAssetValue: number;
    inUseAssetsCount: number;
    availableAssetsCount: number;
    lowStockCount: number;
  };
}

export function StocksClient({
  assets,
  inventoryItems,
  users,
  kpis,
}: StocksClientProps) {
  const [activeTab, setActiveTab] = useState<"ASSETS" | "INVENTORY">("ASSETS");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItemData | null>(null);

  // New Asset Form
  const [assetName, setAssetName] = useState("");
  const [assetSerial, setAssetSerial] = useState("");
  const [assetCategory, setAssetCategory] = useState("Photo & Vidéo");
  const [assetPrice, setAssetPrice] = useState<number>(120000);
  const [assetUserId, setAssetUserId] = useState("");

  // New Inventory Item Form
  const [itemName, setItemName] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemQty, setItemQty] = useState<number>(500);
  const [itemMin, setItemMin] = useState<number>(100);
  const [itemPrice, setItemPrice] = useState<number>(25);

  // Movement Form
  const [mvtType, setMvtType] = useState<StockMovementType>("IN");
  const [mvtQty, setMvtQty] = useState<number>(50);
  const [mvtReason, setMvtReason] = useState("");

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) {
      alert("Nom de l'équipement requis");
      return;
    }

    startTransition(async () => {
      try {
        await createAssetAction({
          name: assetName,
          serialNumber: assetSerial,
          category: assetCategory,
          price: assetPrice,
          assignedToId: assetUserId || undefined,
        });
        setShowAssetModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur d'ajout de matériel");
      }
    });
  };

  const handleUpdateAssetStatus = (
    id: string,
    status: AssetStatus,
    assignedToId?: string | null
  ) => {
    startTransition(async () => {
      try {
        await updateAssetAction(id, {
          status,
          assignedToId: assignedToId !== undefined ? assignedToId : undefined,
        });
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de mise à jour");
      }
    });
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert("Nom de l'article requis");
      return;
    }

    startTransition(async () => {
      try {
        await createInventoryItemAction({
          name: itemName,
          sku: itemSku,
          quantityInStock: itemQty,
          minThreshold: itemMin,
          unitPrice: itemPrice,
        });
        setShowItemModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de création d'article");
      }
    });
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementItem || mvtQty <= 0) return;

    startTransition(async () => {
      try {
        await recordStockMovementAction({
          itemId: movementItem.id,
          type: mvtType,
          quantity: mvtQty,
          reason: mvtReason,
        });
        setMovementItem(null);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de mouvement de stock");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-indigo-400" />
            Inventaire Matériel & Stocks Marketing
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gestion du parc audiovisuel/informatique et suivi des stocks de consommables/goodies.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowItemModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Nouvel Article Stock
          </button>
          <button
            onClick={() => setShowAssetModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Camera className="w-4 h-4" /> Ajouter Matériel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Total Équipements
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Camera className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalAssetsCount}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.availableAssetsCount} disponibles au studio
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Valeur du Parc
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2 font-mono">
            {kpis.totalAssetValue.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-indigo-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Investissement matériel agence</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Matériel en Tournage
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpis.inUseAssetsCount}
          </div>
          <p className="text-xs text-neutral-400 mt-1">Affecté aux collaborateurs</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Alertes Stock Bas
            </span>
            <span className="p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
            {kpis.lowStockCount}
          </div>
          <p className="text-xs text-neutral-400 mt-1">Sous le seuil minimal</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab("ASSETS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "ASSETS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Parc Matériel & Caméras ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab("INVENTORY")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "INVENTORY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Consommables & Goodies ({inventoryItems.length})
        </button>
      </div>

      {/* TAB 1: ASSETS */}
      {activeTab === "ASSETS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Équipement</th>
                  <th className="py-3.5 px-4">N° de Série</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4 text-right">Valeur Estimée</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4">Affecté À</th>
                  <th className="py-3.5 px-4 text-right">Gérer Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucun équipement enregistré.
                    </td>
                  </tr>
                ) : (
                  assets.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {a.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                        {a.serialNumber || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-300">
                        {a.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-200">
                        {a.price.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            a.status === "AVAILABLE"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : a.status === "IN_USE"
                              ? "bg-indigo-950/60 text-indigo-400 border border-indigo-800/40"
                              : a.status === "MAINTENANCE"
                              ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                              : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                          }`}
                        >
                          {a.status === "AVAILABLE"
                            ? "Disponible"
                            : a.status === "IN_USE"
                            ? "En Tournage"
                            : a.status === "MAINTENANCE"
                            ? "Maintenance"
                            : "Hors Service"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-300">
                        {a.assignedTo ? (
                          <span className="font-semibold text-neutral-200">
                            {a.assignedTo.name}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Non affecté</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            value={a.status}
                            onChange={(e) =>
                              handleUpdateAssetStatus(a.id, e.target.value as AssetStatus)
                            }
                            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-300"
                          >
                            <option value="AVAILABLE">Disponible</option>
                            <option value="IN_USE">En Tournage</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="OUT_OF_SERVICE">Hors Service</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY ITEMS */}
      {activeTab === "INVENTORY" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Article</th>
                  <th className="py-3.5 px-4">SKU / Code</th>
                  <th className="py-3.5 px-4 text-center">Stock Actuel</th>
                  <th className="py-3.5 px-4 text-center">Seuil Minimum</th>
                  <th className="py-3.5 px-4 text-right">Prix Unitaire</th>
                  <th className="py-3.5 px-4 text-center">Alerte</th>
                  <th className="py-3.5 px-4 text-right">Mouvement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {inventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucun article en inventaire consommable.
                    </td>
                  </tr>
                ) : (
                  inventoryItems.map((item) => {
                    const isLow = item.quantityInStock <= item.minThreshold;
                    return (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                          {item.sku || "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-base text-neutral-100">
                          {item.quantityInStock}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs text-neutral-400">
                          {item.minThreshold}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-neutral-300">
                          {item.unitPrice} DA
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/40">
                              <AlertTriangle className="w-3 h-3" /> Stock Bas
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/30">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setMovementItem(item);
                              setMvtQty(50);
                              setMvtType("IN");
                              setMvtReason("");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                          >
                            <SlidersHorizontal className="w-3 h-3" /> Ajuster Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NEW ASSET */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Ajouter un Équipement Matériel
                </h3>
              </div>
              <button
                onClick={() => setShowAssetModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Nom du Matériel *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Boîtier Sony A7IV, Drone DJI Mini 4 Pro..."
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Numéro de Série
                  </label>
                  <input
                    type="text"
                    placeholder="S/N: 99482710..."
                    value={assetSerial}
                    onChange={(e) => setAssetSerial(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Catégorie *
                  </label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Photo & Vidéo">Photo & Vidéo</option>
                    <option value="Audio & Micros">Audio & Micros</option>
                    <option value="Éclairage & Studio">Éclairage & Studio</option>
                    <option value="Informatique & PC">Informatique & PC</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Valeur d'Achat (DA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={assetPrice}
                    onChange={(e) => setAssetPrice(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Affecter à un Collaborateur
                  </label>
                  <select
                    value={assetUserId}
                    onChange={(e) => setAssetUserId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Disponible au Studio</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssetModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : "Enregistrer Matériel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW INVENTORY ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvel Article Consommable
                </h3>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Nom de l'article *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Flyers Agence A5, Cartes de Visite..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  SKU / Code Référence
                </label>
                <input
                  type="text"
                  placeholder="SKU-FLY-01"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Qté Initiale
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Seuil Min
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemMin}
                    onChange={(e) => setItemMin(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Prix Unit. (DA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Ajouter à l'Inventaire"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK MOVEMENT */}
      {movementItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <h3 className="text-lg font-bold text-neutral-100">
                Mouvement de Stock : {movementItem.name}
              </h3>
              <button
                onClick={() => setMovementItem(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockMovement} className="p-6 space-y-4">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex justify-between items-center text-sm">
                <span className="text-neutral-400">Stock Actuel :</span>
                <span className="font-mono font-bold text-neutral-100">
                  {movementItem.quantityInStock} unités
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Type de Mouvement *
                  </label>
                  <select
                    value={mvtType}
                    onChange={(e) => setMvtType(e.target.value as StockMovementType)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="IN">Entrée (+)</option>
                    <option value="OUT">Sortie (-)</option>
                    <option value="ADJUSTMENT">Ajustement Direct</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={mvtQty}
                    onChange={(e) => setMvtQty(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Motif / Justificatif
                </label>
                <input
                  type="text"
                  placeholder="Ex: Distribution salon, Réception commande..."
                  value={mvtReason}
                  onChange={(e) => setMvtReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMovementItem(null)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Validation..." : "Valider Mouvement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
