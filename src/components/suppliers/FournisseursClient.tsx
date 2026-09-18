"use client";

import React, { useState, useTransition } from "react";
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  X,
  DollarSign,
  Package,
} from "lucide-react";
import {
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
} from "@/actions/suppliers";

interface SupplierOrder {
  id: string;
  amount: number;
  category: string;
  status: string;
  orderedAt: Date | string;
  project?: { id: string; name: string; code: string } | null;
}

interface SupplierItem {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category: string;
  notes?: string | null;
  totalSpent: number;
  orders: SupplierOrder[];
}

interface FournisseursClientProps {
  suppliers: SupplierItem[];
}

const CATEGORIES = [
  "Production (Vidéastes, Monteurs)",
  "Digital & SaaS (Hosting, Outils)",
  "Régies Publicitaires (Meta, Google)",
  "Impression & Goodies",
  "Services Généraux & Locaux",
];

export function FournisseursClient({ suppliers }: FournisseursClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [notes, setNotes] = useState("");

  const filteredSuppliers = suppliers.filter((s) => {
    if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.company && s.company.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }
    return true;
  });

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Le nom du fournisseur est obligatoire.");
      return;
    }

    startTransition(async () => {
      try {
        await createSupplierAction({
          name,
          company,
          phone,
          email,
          address,
          category,
          notes,
        });
        setShowAddModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la création");
      }
    });
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    startTransition(async () => {
      try {
        await updateSupplierAction(editingSupplier.id, {
          name: editingSupplier.name,
          company: editingSupplier.company || undefined,
          phone: editingSupplier.phone || undefined,
          email: editingSupplier.email || undefined,
          address: editingSupplier.address || undefined,
          category: editingSupplier.category,
          notes: editingSupplier.notes || undefined,
        });
        setEditingSupplier(null);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de mise à jour");
      }
    });
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm("Supprimer ce fournisseur ?")) return;

    startTransition(async () => {
      try {
        await deleteSupplierAction(id);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-indigo-400" />
            Répertoire des Fournisseurs & Prestataires
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gestion des freelances (vidéastes, monteurs, voix-off), régies pub et prestataires agence.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Nouveau Fournisseur
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, société, tél..."
            className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setCategoryFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              categoryFilter === "ALL"
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:text-white bg-neutral-950/60"
            }`}
          >
            Tous ({suppliers.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? "bg-indigo-600 text-white"
                  : "text-neutral-400 hover:text-white bg-neutral-950/60"
              }`}
            >
              {cat.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-neutral-400 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
            Aucun fournisseur répertorié.
          </div>
        ) : (
          filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-neutral-100 text-base">{s.name}</h3>
                    {s.company && (
                      <div className="text-xs text-indigo-400 font-medium">
                        {s.company}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-800 text-neutral-300">
                    {s.category}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-400 mt-3 pt-3 border-t border-neutral-800/60">
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-mono">{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{s.address}</span>
                    </div>
                  )}
                </div>

                {s.notes && (
                  <div className="text-xs text-neutral-400 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800 mt-3 italic">
                    "{s.notes}"
                  </div>
                )}
              </div>

              {/* Footer: Volume d'affaires & Actions */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-500">
                    Commandes Passées
                  </div>
                  <div className="font-mono font-bold text-sm text-neutral-200">
                    {s.totalSpent.toLocaleString("fr-FR")} DA ({s.orders.length})
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingSupplier(s)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                    title="Modifier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(s.id)}
                    className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800/30 transition"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: ADD SUPPLIER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouveau Fournisseur / Prestataire
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Nom / Contact *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Société / Raison Sociale
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Catégorie de Service *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    placeholder="05 / 06 / 07..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Adresse / Wilaya
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alger, Oran..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Notes / Grille Tarifaire
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Monteur vidéo 4K, 15000 DA par capsule..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : "Ajouter Fournisseur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <h3 className="text-lg font-bold text-neutral-100">
                Modifier : {editingSupplier.name}
              </h3>
              <button
                onClick={() => setEditingSupplier(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.name}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, name: e.target.value })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Société
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.company || ""}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, company: e.target.value })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Catégorie
                </label>
                <select
                  value={editingSupplier.category}
                  onChange={(e) =>
                    setEditingSupplier({ ...editingSupplier, category: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ""}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, phone: e.target.value })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingSupplier.email || ""}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, email: e.target.value })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editingSupplier.notes || ""}
                  onChange={(e) =>
                    setEditingSupplier({ ...editingSupplier, notes: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
