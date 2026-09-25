# Spécification Technique — Refonte UI/UX Globale BOOSTERA ERP

- **Date** : 2026-09-26
- **Auteur** : Antigravity (UI/UX Pro Max Engine)
- **Produit** : BOOSTERA ERP (SaaS ERP & CRM B2B Agence Digitale)
- **Style retenu** : **B2B SaaS Luxe & Glassmorphism** (Validé par l'utilisateur)

---

## 1. Vision & Objectifs Esthétiques

Transformer l'interface de BOOSTERA ERP en un tableau de bord SaaS de classe mondiale inspiré des meilleurs standards du marché (Linear, Stripe, Raycast, Vercel) :
1. **Élégance Visuelle Immédiate (Effet "WOW")** : Fond sombre texturé d'une aura lumineuse diffuse (*ambient mesh gradient*), cartes en verre fumé (*frosted glassmorphism*) avec des liserés discrets et réflectifs.
2. **Typographie SaaS Haute Définition** : Intégration de la police **Plus Jakarta Sans** pour les titres et corps de texte, couplée à une hiérarchie typographique stricte et contrastée.
3. **Micro-Interactions Vivantes** : Retours visuels au survol (élévation douce, lueur subtile), press feedback (`active:scale-[0.98]`), transitions soignées (150-250ms cubic-bezier).
4. **Ergonomie & Lisibilité (WCAG 2.2 AA)** : Ratios de contraste ≥ 4.5:1 sur tous les textes, suppression des contrastes agressifs ou ternes, suppression de tout émoji comme icône structurelle.

---

## 2. Système de Design (Tokens & Variables)

### 2.1 Palette de Couleurs (Mode Sombre Luxe)
* **Background Profond** : `#080c14` (fond de base) avec dégradé radial subtil `rgba(37,99,235,0.08)` au sommet.
* **Surface Carte Glass** : `rgba(17, 24, 39, 0.65)` avec `backdrop-filter: blur(16px)` et bordure `1px solid rgba(255, 255, 255, 0.08)`.
* **Accent Primaire** : `#2563eb` (Bleu Roi Tech) / `#3b82f6` (Bleu Électrique).
* **Accent Secondaire** : `#6366f1` (Indigo) / `#8b5cf6` (Violet Neon).
* **Statuts Sémantiques** :
  * Succès : Émeraude `#10b981` (badge `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`).
  * Alerte / En cours : Ambre `#f59e0b` (badge `bg-amber-500/10 text-amber-400 border-amber-500/20`).
  * Danger / Retard : Rose `#f43f5e` (badge `bg-rose-500/10 text-rose-400 border-rose-500/20`).
  * Information / IA : Cyan / Violet `#06b6d4` & `#a855f7`.

### 2.2 Typographie
* **Police Principale** : `Plus Jakarta Sans`, sans-serif.
* **Monospace Chiffres / Données** : `JetBrains Mono` / `Geist Mono`.
* **Échelle** :
  * Hero Title : `24px` à `30px`, font-extrabold, tracking-tight.
  * Card Header : `14px` à `16px`, font-bold, text-neutral-100.
  * Micro-labels : `10px` à `11px`, font-semibold, uppercase, tracking-wider, text-neutral-400.
  * KPI Figures : `28px` à `36px`, font-black, font-sans / font-mono.

### 2.3 Effets & Ombres
* **Bordures d'Éclat (*Inner Highlight*)** : `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06)`.
* **Ombres Portées Diffuses** : `box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5)`.
* **Lueur d'accent au survol** : `box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.15)`.

---

## 3. Plan d'Implémentation Atomique

- [ ] **Étape 1 : Fondations CSS & Typographie**
  - Mettre à jour `src/app/globals.css` avec le nouveau design system (tokens glassmorphism, lueurs ambiantes, barres de défilement discrètes, composants de cartes).
  - Configurer `src/app/layout.tsx` pour importer `Plus_Jakarta_Sans` et appliquer l'ambiance lumineuse en arrière-plan.
- [ ] **Étape 2 : Composants UI Atomes**
  - Moderniser `src/components/ui/Button.tsx` (micro-interactions, gradients doux, effet de press).
  - Moderniser `src/components/ui/KpiCard.tsx` (cartes Bento, icônes duotone lumineuses, pilules de tendance).
  - Moderniser `src/components/ui/Badge.tsx` et `Modal.tsx`.
- [ ] **Étape 3 : Structure Globale (Layout & Navigation)**
  - Rehausser `src/components/layout/Sidebar.tsx` (glassmorphism avec blur 20px, indicateur vertical lumineux sur l'onglet actif, badges de navigation modernisés).
  - Rehausser `src/components/layout/Header.tsx` (verre fumé dépoli, pilules de profil et notifications soignées).
- [ ] **Étape 4 : Pages Clés & Dashboard**
  - Sublimer la page de connexion (`src/app/login/page.tsx`) avec un halo lumineux et une carte centrale en verre poli.
  - Vérifier et harmoniser le tableau de bord exécutif (`ExecutiveDashboard.tsx`).
- [ ] **Étape 5 : Validation & Déploiement**
  - Compilation `bun run build`.
  - Mise à jour du pack `erp-deploy.zip` pour cPanel.
  - Git commit & push vers GitHub (déploiement automatique Vercel).
