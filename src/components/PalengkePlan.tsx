/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  Circle, 
  Copy, 
  Check, 
  RotateCcw, 
  Search, 
  ChefHat, 
  Scale, 
  UtensilsCrossed,
  Info
} from 'lucide-react';
import { GlobalState, Recipe, Ingredient } from '../types';
import { DEFAULT_RECIPES } from '../utils';

interface PalengkePlanProps {
  state: GlobalState;
  updateRecipes: (recipes: Recipe[]) => void;
}

const INGREDIENT_CATEGORIES = [
  { id: 'meat', label: 'Meat 🥩', bg: 'bg-rose-50', border: 'border-rose-150', text: 'text-rose-800' },
  { id: 'poultry', label: 'Poultry 🍗', bg: 'bg-amber-50', border: 'border-amber-150', text: 'text-amber-800' },
  { id: 'seafood', label: 'Seafood 🐟', bg: 'bg-blue-50', border: 'border-blue-150', text: 'text-blue-800' },
  { id: 'vegetables', label: 'Vegetables 🥬', bg: 'bg-emerald-50', border: 'border-emerald-150', text: 'text-emerald-800' },
  { id: 'condiments', label: 'Condiments & Herbs 🧂', bg: 'bg-stone-100/60', border: 'border-stone-200', text: 'text-stone-700' },
  { id: 'others', label: 'Grains & Others 📦', bg: 'bg-indigo-50', border: 'border-indigo-150', text: 'text-indigo-800' }
] as const;

const DISH_EMOJIS = ['🍛', '🍲', '🍗', '🍜', '🍱', '🍤', '🥩', '🥘', '🍳', '🥗', '🥦', '🥣', '🐟', '🐷', '🍅', '🧄', '🧅'];

export default function PalengkePlan({ state, updateRecipes }: PalengkePlanProps) {
  const recipesList = useMemo(() => state.recipes || DEFAULT_RECIPES, [state.recipes]);

  // Search and controls
  const [searchTerm, setSearchTerm] = useState('');
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [copied, setCopied] = useState(false);

  // Form / Modal State for Adding/Editing Recipe
  const [recipeModal, setRecipeModal] = useState<{
    id?: string;
    name: string;
    emoji: string;
    description: string;
    ingredients: Ingredient[];
  } | null>(null);

  // Temporary row inside ingredient builder
  const [newIngName, setNewIngName] = useState('');
  const [newIngAmount, setNewIngAmount] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('g');
  const [newIngCategory, setNewIngCategory] = useState<Ingredient['category']>('vegetables');

  // Multiplier options
  const multipliers = [1, 2, 3, 5, 8];

  // Helper to standardise ingredient keys for reliable aggregation
  const getIngredientKey = (ingName: string, unit: string) => {
    return `${ingName.trim().toLowerCase()}_${unit.trim().toLowerCase()}`;
  };

  // Aggregation of selected recipes
  const aggregatedIngredients = useMemo(() => {
    const selectedRecipes = recipesList.filter(r => r.isSelected);
    const aggregation: Record<string, { name: string; amount: number; unit: string; category: Ingredient['category'] }> = {};

    selectedRecipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        const key = getIngredientKey(ing.name, ing.unit);
        const scaledAmount = ing.amount * servingMultiplier;
        
        if (aggregation[key]) {
          aggregation[key].amount += scaledAmount;
        } else {
          aggregation[key] = {
            name: ing.name.trim(),
            amount: scaledAmount,
            unit: ing.unit.trim(),
            category: ing.category
          };
        }
      });
    });

    return Object.values(aggregation);
  }, [recipesList, servingMultiplier]);

  // Toggle selection of a recipe card
  const toggleRecipeSelection = (recipeId: string) => {
    const updated = recipesList.map(r => r.id === recipeId ? { ...r, isSelected: !r.isSelected } : r);
    updateRecipes(updated);
  };

  const selectAllRecipes = () => {
    const updated = recipesList.map(r => ({ ...r, isSelected: true }));
    updateRecipes(updated);
  };

  const deselectAllRecipes = () => {
    const updated = recipesList.map(r => ({ ...r, isSelected: false }));
    updateRecipes(updated);
  };

  const resetToDefaultRecipes = () => {
    if (window.confirm('Are you sure you want to reset recipes to DINK defaults? Any custom recipe entries will be overwritten.')) {
      updateRecipes(DEFAULT_RECIPES);
    }
  };

  // Delete a recipe card
  const deleteRecipeCard = (recipeId: string, name: string) => {
    if (window.confirm(`Delete "${name}" recipe profile permanently?`)) {
      const updated = recipesList.filter(r => r.id !== recipeId);
      updateRecipes(updated);
    }
  };

  // Save Recipe submission (handles both Add and Edit)
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeModal) return;
    if (!recipeModal.name.trim()) {
      alert('Please enter a recipe name.');
      return;
    }
    if (recipeModal.ingredients.length === 0) {
      alert('Please add at least one ingredient to save this recipe!');
      return;
    }

    const trimmedName = recipeModal.name.trim();
    const cleanId = recipeModal.id || `rec_${Date.now()}`;

    const newOrUpdatedRecipe: Recipe = {
      id: cleanId,
      name: trimmedName,
      emoji: recipeModal.emoji || '🥘',
      description: recipeModal.description.trim() || 'Custom delicious ulam specification.',
      ingredients: recipeModal.ingredients,
      isSelected: recipeModal.id ? recipesList.find(r => r.id === recipeModal.id)?.isSelected ?? true : true
    };

    let updatedList: Recipe[];
    if (recipeModal.id) {
      // Edit mode
      updatedList = recipesList.map(r => r.id === recipeModal.id ? newOrUpdatedRecipe : r);
    } else {
      // Add mode
      updatedList = [...recipesList, newOrUpdatedRecipe];
    }

    updateRecipes(updatedList);
    setRecipeModal(null);
  };

  // Add temp ingredient to current modal state
  const handleAddTempIngredient = () => {
    if (!newIngName.trim()) return;
    const amountNum = parseFloat(newIngAmount) || 1;

    const newIng: Ingredient = {
      name: newIngName.trim(),
      amount: amountNum,
      unit: newIngUnit.trim(),
      category: newIngCategory
    };

    if (recipeModal) {
      setRecipeModal({
        ...recipeModal,
        ingredients: [...recipeModal.ingredients, newIng]
      });
    }

    setNewIngName('');
    setNewIngAmount('');
  };

  // Remove ingredient row during recipe edit
  const handleRemoveTempIngredient = (indexNum: number) => {
    if (!recipeModal) return;
    const filtered = recipeModal.ingredients.filter((_, i) => i !== indexNum);
    setRecipeModal({
      ...recipeModal,
      ingredients: filtered
    });
  };

  // Filter list by search term
  const filteredRecipes = recipesList.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Copy plain text checkout list to clipboard
  const copyFormattedMarketList = () => {
    if (aggregatedIngredients.length === 0) return;
    
    let text = `🛒 *MY PALENGKE BASKET MARKET CHECKLIST (Serving multiplier: ${servingMultiplier}x)*\n`;
    text += `Selected Dishes:\n`;
    recipesList.filter(r => r.isSelected).forEach(r => {
      text += ` - ${r.emoji} ${r.name}\n`;
    });
    text += `\n`;

    INGREDIENT_CATEGORIES.forEach(cat => {
      const items = aggregatedIngredients.filter(i => i.category === cat.id);
      if (items.length > 0) {
        text += `🔹 *${cat.label.toUpperCase()}*\n`;
        items.forEach(item => {
          text += ` [ ] ${item.amount} ${item.unit} ${item.name}\n`;
        });
        text += `\n`;
      }
    });

    text += `Generated with Love inside DINK Finance & Meal Tracker ❤️ ₱`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-8" id="palengke-plan-tab-content">
      {/* ─── DINK PALENGKE INTRO PANEL ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-stone-900 font-display flex items-center gap-2">
            🧺 Palengke & Ulam Planner
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-1 leading-relaxed max-w-xl">
            Scale-batch ingredients natively. Log recipes for your partner's favorite dishes, select active meals for the week, and watch ingredients tally up automatically at the top below so you know exactly what budget and portions to fetch from the dry/wet market.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setRecipeModal({ name: '', emoji: '🍲', description: '', ingredients: [] })}
            className="bg-stone-900 text-stone-50 hover:bg-stone-850 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition font-display inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> + New Custom Ulam
          </button>
          
          <button 
            onClick={resetToDefaultRecipes}
            title="Reset active list to factory DINK favorites"
            className="border border-stone-300 text-stone-600 hover:text-stone-900 bg-[#FAF8F5] hover:bg-[#DDD8CE]/35 text-xs font-bold px-3 py-2.5 rounded-xl transition font-display inline-flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Defaults
          </button>
        </div>
      </div>

      {/* ─── 1. TOP SUMMATION PANEL: PALENGKE SHOPPING LIST (AGGREGATION ENGINE) ─── */}
      <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-md relative overflow-hidden">
        {/* Decorative corner background */}
        <div className="absolute right-0 top-0 text-stone-100 opacity-60 translate-x-5 -translate-y-5 select-none pointer-events-none">
          <ChefHat size={160} />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8E8779] font-display">Combined Palengke Wet Market Cart Tally</span>
              <h3 className="text-lg font-black font-display tracking-tight text-stone-900 flex items-center gap-1.5 mt-0.5">
                📋 Dynamic Ingredients Shopping Checkout
              </h3>
            </div>

            {/* Serving Multiplier Engine */}
            <div className="bg-[#FAF8F5] border border-stone-300/60 rounded-2xl p-2.5 flex items-center gap-4 shadow-inner">
              <div className="flex items-center gap-1.5">
                <Scale size={14} className="text-stone-500" />
                <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider font-display shrink-0">Batch Portions:</span>
              </div>
              <div className="flex items-center gap-1">
                {multipliers.map(mult => (
                  <button
                    key={mult}
                    onClick={() => setServingMultiplier(mult)}
                    className={`w-8 h-8 rounded-lg text-xs font-black font-display transition cursor-pointer ${
                      servingMultiplier === mult 
                        ? 'bg-stone-900 text-stone-50 shadow-sm'
                        : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {aggregatedIngredients.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-10 px-4 border border-dashed border-stone-300 rounded-2xl bg-stone-100/30 flex flex-col items-center text-center max-w-lg mx-auto"
              >
                <div className="w-12 h-12 bg-[#EAE4D8] rounded-full flex items-center justify-center text-stone-600 mb-3 text-lg">
                  🧺
                </div>
                <h4 className="text-xs font-black text-stone-800 font-display">Shopping Cart is Empty</h4>
                <p className="text-[11px] text-stone-500 font-medium leading-relaxed mt-1 max-w-sm">
                  Select one or more ulam recipes from the library cards below. Their required ingredients, spices, and portions will sum together here immediately.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Active Recipes Badges Summary */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#FAF8F5]/80 border border-stone-200/80 rounded-xl">
                  <span className="text-[10px] uppercase font-extrabold text-stone-400 tracking-wider font-display pr-1.5 py-0.5 border-r border-stone-200 pl-1">
                    Meals Selected ({recipesList.filter(r => r.isSelected).length}):
                  </span>
                  {recipesList.filter(r => r.isSelected).map(r => (
                    <span 
                      key={r.id} 
                      onClick={() => toggleRecipeSelection(r.id)}
                      className="px-2.5 py-1 bg-stone-200 hover:bg-red-100 hover:text-red-800 text-stone-800 text-[10px] font-bold rounded-lg border border-stone-300/40 cursor-pointer inline-flex items-center gap-1 select-none transition"
                      title="Click to quickly unselect"
                    >
                      <span>{r.emoji}</span>
                      <span>{r.name}</span>
                      <span className="text-[8px] opacity-60 font-black">×</span>
                    </span>
                  ))}
                </div>

                {/* Grid of Categorized Summed Ingredients */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {INGREDIENT_CATEGORIES.map(cat => {
                    const groupItems = aggregatedIngredients.filter(item => item.category === cat.id);
                    if (groupItems.length === 0) return null;

                    return (
                      <div 
                        key={cat.id} 
                        className={`rounded-2xl border ${cat.border} ${cat.bg} p-4 shadow-sm flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-1.5 border-b border-stone-200/90 mb-3">
                            <span className={`text-[10px] font-black uppercase font-display tracking-widest ${cat.text}`}>
                              {cat.label}
                            </span>
                            <span className="text-[10px] font-black bg-white/70 px-2 py-0.5 rounded-full border border-stone-200 shrink-0">
                              {groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <ul className="space-y-2">
                            {groupItems.map((item, idx) => (
                              <li key={idx} className="flex items-center justify-between text-xs text-stone-800 leading-none">
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full shrink-0"></div>
                                  <span className="font-semibold truncate">{item.name}</span>
                                </div>
                                <span className="font-mono text-xs font-black tracking-tight text-stone-900 shrink-0 text-right bg-white/60 px-1.5 py-0.5 rounded border border-stone-150 pl-2">
                                  {item.amount.toLocaleString()} <span className="text-[10px] text-stone-500 font-bold">{item.unit}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Call-to-actions under checkout table */}
                <div className="flex justify-between items-center pt-4 border-t border-stone-200/80">
                  <span className="text-[10px] text-stone-400 font-bold flex items-center gap-1">
                    <Info size={11} className="shrink-0" />
                    Checking list is auto-sorted dynamically. Share to WhatsApp or Notes!
                  </span>
                  
                  <button
                    onClick={copyFormattedMarketList}
                    className="bg-emerald-750 text-xs font-bold px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-stone-50 rounded-xl transition shadow-sm inline-flex items-center gap-2 cursor-pointer font-display"
                  >
                    {copied ? (
                      <>
                        <Check size={13} /> Copied Checklist!
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy Market Text Checklist
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── 2. SEARCH & PANEL TOOLBAR ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-[#EAE4D8]/60 border border-stone-300/70 rounded-2xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search recipes, ingredients or classification..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs font-semibold pl-9 pr-4 py-2 bg-stone-100/50 border border-stone-300 rounded-xl outline-none focus:bg-stone-50 focus:border-stone-500 transition shadow-inner font-display"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectAllRecipes}
            className="bg-[#FAF8F5] border border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-250 text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-2 rounded-lg transition font-display shadow-sm cursor-pointer"
          >
            Select All
          </button>
          <button
            onClick={deselectAllRecipes}
            className="bg-[#FAF8F5] border border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-250 text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-2 rounded-lg transition font-display shadow-sm cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* ─── 3. ULAM RECIPE CARDS LIBRARY ─── */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black font-display tracking-tight text-stone-800 uppercase">
            🥘 Dish Library ({filteredRecipes.length} registered recipes)
          </h3>
          {searchTerm && (
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Filtered search
            </span>
          )}
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-stone-300/80 rounded-3xl bg-stone-50">
            <UtensilsCrossed size={32} className="text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-600">No dishes match your search keywords</p>
            <p className="text-[10px] text-stone-400 mt-1">Try other search queries or add this item as a custom ulam recipe above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => toggleRecipeSelection(recipe.id)}
                className={`group relative rounded-2xl border bg-[#FAF8F5] cursor-pointer transition flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  recipe.isSelected 
                    ? 'border-emerald-600 ring-2 ring-emerald-600/10' 
                    : 'border-stone-300 hover:border-stone-400'
                }`}
              >
                {/* Active Check Indicator Top Corner */}
                <div className="absolute right-3 top-3 z-10">
                  {recipe.isSelected ? (
                    <div className="h-5.5 w-5.5 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow">
                      <CheckCircle size={15} />
                    </div>
                  ) : (
                    <div className="h-5 w-5 text-stone-300 group-hover:text-stone-400 bg-white/40 rounded-full flex items-center justify-center">
                      <Circle size={15} />
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 select-none">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl p-1 bg-stone-200/50 rounded-xl shrink-0 font-display">
                      {recipe.emoji || '🍲'}
                    </div>
                    <div className="pr-5 min-w-0">
                      <h4 className="text-xs font-black text-stone-900 font-display leading-snug tracking-tight">
                        {recipe.name}
                      </h4>
                      <p className="text-[10px] leading-relaxed text-stone-500 font-semibold mt-1 min-h-[32px] line-clamp-2">
                        {recipe.description}
                      </p>
                    </div>
                  </div>

                  {/* Ingredients Peek Inside Card */}
                  <div className="mt-4 pt-3.5 border-t border-stone-200/80">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] uppercase font-extrabold text-[#8E8779] tracking-wider font-display">Raw Ingredient specs:</span>
                      <span className="text-[9px] font-bold text-stone-400">{recipe.ingredients.length} items</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[82px] overflow-hidden">
                      {recipe.ingredients.map((ing, iIdx) => (
                        <span 
                          key={iIdx} 
                          className="px-1.5 py-0.5 bg-stone-200/50 border border-stone-250/20 text-stone-605 text-[9px] font-bold rounded"
                        >
                          {ing.amount}
                          <span className="text-[8px] opacity-70 font-semibold">{ing.unit}</span> {ing.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Quick Actions Footer Toolbelt */}
                <div 
                  className="bg-stone-100/80 border-t border-stone-200/70 py-2 px-4 flex justify-end gap-2"
                  onClick={e => e.stopPropagation() /* Prevent card selection toggle */}
                >
                  <button
                    onClick={() => setRecipeModal({
                      id: recipe.id,
                      name: recipe.name,
                      emoji: recipe.emoji,
                      description: recipe.description,
                      ingredients: [...recipe.ingredients]
                    })}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded transition shrink-0 inline-flex items-center gap-1 text-[10px] font-bold"
                    title="Change Recipe parameters"
                  >
                    <Edit3 size={11} /> Edit Specs
                  </button>
                  <button
                    onClick={() => deleteRecipeCard(recipe.id, recipe.name)}
                    className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded transition shrink-0 inline-flex items-center gap-1 text-[10px] font-bold"
                    title="Delete permanently"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 4. ADD / EDIT RECIPE MODAL PANEL ─── */}
      <AnimatePresence>
        {recipeModal && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col justify-between"
              onClick={e => e.stopPropagation()}
            >
              <div>
                <div className="flex justify-between items-center mb-5 pb-2 border-b border-stone-200">
                  <h3 className="text-md font-extrabold font-display uppercase tracking-widest text-stone-850 flex items-center gap-2">
                    {recipeModal.id ? '📝 Modify Recipe Parameters' : '🍱 Write Custom Ulam Profile'}
                  </h3>
                  <button onClick={() => setRecipeModal(null)} className="text-stone-400 hover:text-stone-700 text-lg">
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSaveRecipe} className="space-y-4 text-xs font-semibold text-stone-700">
                  <div className="grid grid-cols-4 gap-4">
                    {/* Emoji Select Tool */}
                    <div className="col-span-1 space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Emoji</label>
                      <select
                        className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100 outline-none text-center"
                        value={recipeModal.emoji}
                        onChange={e => setRecipeModal({ ...recipeModal, emoji: e.target.value })}
                        required
                      >
                        {DISH_EMOJIS.map((emo, idx) => (
                          <option key={idx} value={emo}>{emo}</option>
                        ))}
                      </select>
                    </div>

                    {/* Recipe name */}
                    <div className="col-span-3 space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Recipe / Ulam Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Pork Sinigang Original"
                        value={recipeModal.name}
                        onChange={e => setRecipeModal({ ...recipeModal, name: e.target.value })}
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100 outline-none focus:bg-stone-55 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Recipe description / notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Local soup flavored with real tamarind powder."
                      value={recipeModal.description}
                      onChange={e => setRecipeModal({ ...recipeModal, description: e.target.value })}
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100 outline-none focus:bg-stone-55 transition"
                    />
                  </div>

                  {/* Ingredients Listing Block */}
                  <div className="border border-stone-200/80 rounded-2xl p-4 bg-[#FAF8F5]">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E8779] font-display block mb-3">
                      🔬 Ingredient Measurements ({recipeModal.ingredients.length})
                    </span>

                    {/* Interactive builder form inputs */}
                    <div className="bg-stone-105 p-3 border border-stone-200 rounded-xl space-y-2.5 mb-4 shadow-inner">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-stone-400">Ingredient Item</label>
                          <input
                            type="text"
                            placeholder="e.g. Pork belly, Spinach"
                            value={newIngName}
                            onChange={e => setNewIngName(e.target.value)}
                            className="w-full text-[11px] font-semibold border border-stone-200 rounded-lg p-1.5 bg-white outline-none"
                          />
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-stone-400">Section Group</label>
                          <select
                            className="w-full text-[11px] font-semibold border border-stone-200 rounded-lg p-1.5 bg-white outline-none"
                            value={newIngCategory}
                            onChange={e => setNewIngCategory(e.target.value as any)}
                          >
                            <option value="meat">Meat 🥩</option>
                            <option value="poultry">Poultry 🍗</option>
                            <option value="seafood">Seafood 🐟</option>
                            <option value="vegetables">Vegetables 🥬</option>
                            <option value="condiments">Condiments & Herbs 🧂</option>
                            <option value="others">Grains & Others 📦</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end">
                        {/* Portion size */}
                        <div className="space-y-1 col-span-1">
                          <label className="text-[9px] font-bold text-stone-400">Portion Amt</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="500"
                            value={newIngAmount}
                            onChange={e => setNewIngAmount(e.target.value)}
                            className="w-full text-[11px] font-semibold border border-stone-200 rounded-lg p-1.5 bg-white outline-none text-right font-mono"
                          />
                        </div>

                        {/* Unit type */}
                        <div className="space-y-1 col-span-1">
                          <label className="text-[9px] font-bold text-stone-400">Measurement</label>
                          <input
                            type="text"
                            placeholder="e.g. g, pcs, cloves"
                            value={newIngUnit}
                            onChange={e => setNewIngUnit(e.target.value)}
                            className="w-full text-[11px] font-semibold border border-stone-200 rounded-lg p-1.5 bg-white outline-none"
                          />
                        </div>

                        {/* Button adding */}
                        <button
                          type="button"
                          onClick={handleAddTempIngredient}
                          disabled={!newIngName.trim()}
                          className="bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-400 text-[10px] font-black uppercase tracking-wider h-8 rounded-lg transition"
                        >
                          + Set Item
                        </button>
                      </div>
                    </div>

                    {/* Existing ingredient rows list */}
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-200/50">
                      {recipeModal.ingredients.length === 0 ? (
                        <p className="text-[10px] text-stone-400 font-semibold text-center py-4">
                          No ingredients loaded yet. Add items above to build the recipe!
                        </p>
                      ) : (
                        recipeModal.ingredients.map((ing, iIdx) => (
                          <div key={iIdx} className="flex items-center justify-between py-1.5 text-xs text-stone-805 font-bold">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] bg-stone-200 rounded px-1 shrink-0">
                                {INGREDIENT_CATEGORIES.find(c => c.id === ing.category)?.label.split(' ')[0] || '📦'}
                              </span>
                              <span className="truncate">{ing.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs text-stone-605">
                                {ing.amount} <span className="text-[10px] font-bold">{ing.unit}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTempIngredient(iIdx)}
                                className="text-red-500 hover:text-red-700 p-0.5"
                                title="Remove item specifications"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Actions toolbar */}
                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                    <button type="button" onClick={() => setRecipeModal(null)} className="btn btn-ghost text-xs">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={recipeModal.ingredients.length === 0}
                      className="btn btn-primary bg-stone-900 hover:bg-stone-850 text-stone-50 px-4 py-2 rounded-xl text-xs transition font-bold font-display disabled:bg-stone-300 disabled:text-stone-400"
                    >
                      Save Recipe Parameters
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
