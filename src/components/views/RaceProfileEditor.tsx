import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Crosshair,
  Flag,
  Activity,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { RaceProfile, RaceLegConfig, Category, LegType, ShootingStance } from '../../types';
import { db } from '../../db/dexieDb';
import { operationService } from '../../services/operationService';
import { soundService } from '../../services/soundService';

interface RaceProfileEditorProps {
  profiles: RaceProfile[];
  categories: Category[];
  onRefresh: () => void;
}

export const RaceProfileEditor: React.FC<RaceProfileEditorProps> = ({
  profiles,
  categories,
  onRefresh,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles[0]?.id || 'new-profile'
  );

  // Form State
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [penaltySeconds, setPenaltySeconds] = useState<number>(20);
  const [penaltyLaps, setPenaltyLaps] = useState<number>(1);
  const [legs, setLegs] = useState<RaceLegConfig[]>([]);
  const [assignedCategoryIds, setAssignedCategoryIds] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState<boolean>(false);
  const [categoryId, setCategoryId] = useState('new-category');
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryGender, setCategoryGender] = useState<'M' | 'F' | 'ALL'>('ALL');
  const [categoryMinAge, setCategoryMinAge] = useState(6);
  const [categoryMaxAge, setCategoryMaxAge] = useState<number | ''>('');
  const [categoryProfileId, setCategoryProfileId] = useState('');

  const loadProfileIntoForm = (prof: RaceProfile | undefined) => {
    if (prof) {
      setSelectedProfileId(prof.id);
      setName(prof.name);
      setDescription(prof.description || '');
      setPenaltySeconds(prof.penaltySecondsPerMiss || 20);
      setPenaltyLaps(prof.penaltyLapsPerMiss || 1);
      setLegs(prof.legs || []);
      const assigned = categories
        .filter((c) => c.raceProfileId === prof.id)
        .map((c) => c.id);
      setAssignedCategoryIds(assigned);
    } else {
      startNewProfile();
    }
  };

  const startNewProfile = () => {
    setSelectedProfileId('new-profile');
    setName('Nieuw Wedstrijdprofiel (Loop - Schiet - Loop...)');
    setDescription('Aangepast parcours: Loop, schiet, loop, schiet, loop...');
    setPenaltySeconds(20);
    setPenaltyLaps(1);
    setLegs([
      { id: `leg-${Date.now()}-1`, type: 'RUN', name: 'Loopronde 1', distanceMeters: 1000, laps: 1 },
      { id: `leg-${Date.now()}-2`, type: 'SHOOT', name: 'Schietbeurt 1', shotCount: 5, stance: 'prone', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
      { id: `leg-${Date.now()}-3`, type: 'RUN', name: 'Loopronde 2', distanceMeters: 1000, laps: 1 },
      { id: `leg-${Date.now()}-4`, type: 'SHOOT', name: 'Schietbeurt 2', shotCount: 5, stance: 'standing', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
      { id: `leg-${Date.now()}-5`, type: 'RUN', name: 'Loopronde 3', distanceMeters: 1000, laps: 1 },
      { id: `leg-${Date.now()}-6`, type: 'FINISH', name: 'Finish' },
    ]);
    setAssignedCategoryIds([]);
  };

  // Initial load once
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current) {
      if (profiles.length > 0) {
        loadProfileIntoForm(profiles[0]);
      } else {
        startNewProfile();
      }
      initializedRef.current = true;
    }
  }, [profiles]);

  // Leg helpers
  const handleAddLeg = (type: LegType) => {
    const newId = `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    let newLeg: RaceLegConfig;

    if (type === 'RUN') {
      const runCount = legs.filter((l) => l.type === 'RUN').length + 1;
      newLeg = {
        id: newId,
        type: 'RUN',
        name: `Loopronde ${runCount}`,
        distanceMeters: 1000,
        laps: 1,
      };
    } else if (type === 'SHOOT') {
      const shootCount = legs.filter((l) => l.type === 'SHOOT').length + 1;
      newLeg = {
        id: newId,
        type: 'SHOOT',
        name: `Schietbeurt ${shootCount}`,
        shotCount: 5,
        stance: shootCount % 2 === 1 ? 'prone' : 'standing',
        maxHits: 5,
        penaltyType: 'time',
        penaltyValueSeconds: penaltySeconds,
      };
    } else {
      newLeg = {
        id: newId,
        type: 'FINISH',
        name: 'Finish',
      };
    }

    setLegs([...legs, newLeg]);
  };

  const handleUpdateLeg = (index: number, updates: Partial<RaceLegConfig>) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], ...updates };
    setLegs(updated);
  };

  const handleMoveLeg = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === legs.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...legs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setLegs(updated);
  };

  const handleRemoveLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  const handleToggleCategory = (catId: string) => {
    if (assignedCategoryIds.includes(catId)) {
      setAssignedCategoryIds(assignedCategoryIds.filter((id) => id !== catId));
    } else {
      setAssignedCategoryIds([...assignedCategoryIds, catId]);
    }
  };

  const resetCategoryForm = () => {
    setCategoryId('new-category');
    setCategoryName('');
    setCategoryCode('');
    setCategoryGender('ALL');
    setCategoryMinAge(6);
    setCategoryMaxAge('');
    setCategoryProfileId(profiles.find((profile) => profile.isDefault)?.id || profiles[0]?.id || '');
  };

  const loadCategoryIntoForm = (category: Category) => {
    setCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryCode(category.code);
    setCategoryGender(category.gender);
    setCategoryMinAge(category.minAge ?? 6);
    setCategoryMaxAge(category.maxAge ?? '');
    setCategoryProfileId(category.raceProfileId || '');
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim() || !categoryCode.trim()) return;
    if (categoryMaxAge !== '' && Number(categoryMaxAge) < categoryMinAge) {
      alert('De maximumleeftijd moet gelijk aan of hoger dan de minimumleeftijd zijn.');
      return;
    }

    const id = categoryId === 'new-category' ? `category-${Date.now()}` : categoryId;
    await db.categories.put({
      id,
      name: categoryName.trim(),
      code: categoryCode.trim().toUpperCase(),
      gender: categoryGender,
      minAge: Math.max(1, categoryMinAge),
      maxAge: categoryMaxAge === '' ? undefined : Number(categoryMaxAge),
      raceProfileId: categoryProfileId,
    });
    await operationService.logAudit('CATEGORY_UPDATED', `Categorie "${categoryName.trim()}" opgeslagen.`);
    soundService.playSuccess();
    resetCategoryForm();
    await onRefresh();
  };

  const handleDeleteCategory = async () => {
    if (categoryId === 'new-category') return;
    const category = categories.find((item) => item.id === categoryId);
    if (!category || !confirm(`Categorie "${category.name}" verwijderen? Deelnemers worden niet verwijderd.`)) return;
    await db.categories.delete(category.id);
    await operationService.logAudit('CATEGORY_DELETED', `Categorie "${category.name}" verwijderd.`);
    soundService.playWarning();
    resetCategoryForm();
    await onRefresh();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const profileId =
      selectedProfileId === 'new-profile' ? `profile-${Date.now()}` : selectedProfileId;

    const updatedProfile: RaceProfile = {
      id: profileId,
      name: name.trim() || 'Wedstrijdprofiel',
      description: description.trim(),
      penaltySecondsPerMiss: penaltySeconds,
      penaltyLapsPerMiss: penaltyLaps,
      legs,
      isDefault: profiles.length === 0 || profiles.find((p) => p.id === selectedProfileId)?.isDefault,
    };

    // Save profile to Dexie
    await db.raceProfiles.put(updatedProfile);

    // Update categories that belong to this profile
    for (const cat of categories) {
      if (assignedCategoryIds.includes(cat.id)) {
        if (cat.raceProfileId !== profileId) {
          await db.categories.update(cat.id, { raceProfileId: profileId });
        }
      } else if (cat.raceProfileId === profileId) {
        // Unlinked from this profile
        await db.categories.update(cat.id, { raceProfileId: undefined });
      }
    }

    await operationService.logAudit(
      'SETTINGS_UPDATED',
      `Wedstrijdopbouw profiel "${name}" opgeslagen met ${legs.length} onderdelen`
    );

    soundService.playSuccess();
    setSavedMessage(true);
    setSelectedProfileId(profileId);
    await onRefresh();
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleDeleteProfile = async () => {
    const profToDelete = profiles.find((p) => p.id === selectedProfileId);
    if (!profToDelete) return;

    if (!confirm(`Weet u zeker dat u het profiel "${profToDelete.name}" wilt verwijderen?`)) {
      return;
    }

    await db.raceProfiles.delete(profToDelete.id);
    await db.categories.where('raceProfileId').equals(profToDelete.id).modify({ raceProfileId: undefined });

    await operationService.logAudit(
      'SETTINGS_UPDATED',
      `Wedstrijdprofiel "${profToDelete.name}" verwijderd`
    );

    soundService.playWarning();
    const remaining = profiles.filter((p) => p.id !== profToDelete.id);
    if (remaining.length > 0) {
      loadProfileIntoForm(remaining[0]);
    } else {
      startNewProfile();
    }
    await onRefresh();
  };

  const isExistingProfile = selectedProfileId !== 'new-profile';

  return (
    <div className="space-y-6">
      {/* Intro info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Wedstrijdinhoud & Parcoursopbouw
            </span>
            <h3 className="text-xl font-black text-white mt-1">
              Wedstrijdprofielen & Volgorde van Onderdelen
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Hier stelt u de precieze volgorde in van uw biathlon: bijvoorbeeld{' '}
              <strong className="text-amber-400">
                Loopronde &rarr; Schietbeurt &rarr; Loopronde &rarr; Schietbeurt &rarr; Loopronde &rarr; Finish
              </strong>
              . U kunt afstanden per ronde, aantal schoten (bv. 5 schoten), houding (liggend of staand)
              en straftijden per onderdeel exact instellen en toewijzen aan categorieën.
            </p>
          </div>
        </div>

        {/* Profile Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-400 mr-1">Selecteer Profiel:</span>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadProfileIntoForm(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedProfileId === p.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{p.name}</span>
              <span className="text-[10px] opacity-75">({p.legs?.length || 0} stappen)</span>
            </button>
          ))}

          <button
            type="button"
            onClick={startNewProfile}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              selectedProfileId === 'new-profile'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nieuw Wedstrijdprofiel</span>
          </button>
        </div>
      </div>

      {/* Editor Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Details Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4 text-xs">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" /> Profielgegevens
            </span>
            {isExistingProfile && (
              <button
                type="button"
                onClick={handleDeleteProfile}
                className="text-red-400 hover:text-red-300 font-normal normal-case flex items-center gap-1 bg-red-950/30 px-2.5 py-1 rounded border border-red-800/40"
              >
                <Trash2 className="w-3.5 h-3.5" /> Dit profiel verwijderen
              </button>
            )}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-slate-300 font-semibold block mb-1">Naam van het Profiel:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bv. Volwassenen Biathlon (3x Loop, 2x Schiet)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Standaard Straftijd per Misser:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={penaltySeconds}
                  onChange={(e) => setPenaltySeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold text-sm"
                />
                <span className="text-slate-400 font-semibold">sec</span>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="text-slate-300 font-semibold block mb-1">
                Korte Omschrijving / Parcoursdetails:
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="bv. 1,5 km Loop + 5 Schoten Liggend + 1,5 km Loop + 5 Schoten Staand + 1,5 km Finish"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Legs Sequencer: Loop, Schiet, Loop, Schiet, Finish... */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Volgorde van Wedstrijdonderdelen
                ({legs.length})
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Stel de volgorde in van start tot finish. Verschuif stappen met de pijltjes omhoog/omlaag.
              </p>
            </div>

            {/* Add Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddLeg('RUN')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> + Loopronde
              </button>
              <button
                type="button"
                onClick={() => handleAddLeg('SHOOT')}
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> + Schietbeurt
              </button>
              <button
                type="button"
                onClick={() => handleAddLeg('FINISH')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> + Finish
              </button>
            </div>
          </div>

          {/* Sequential List of Legs */}
          <div className="space-y-3">
            {legs.length === 0 && (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
                Nog geen onderdelen ingesteld. Klik op &ldquo;+ Loopronde&rdquo; of &ldquo;+ Schietbeurt&rdquo; om te beginnen.
              </div>
            )}

            {legs.map((leg, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === legs.length - 1;

              return (
                <div
                  key={leg.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                    leg.type === 'RUN'
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200'
                      : leg.type === 'SHOOT'
                      ? 'bg-blue-950/20 border-blue-900/50 text-blue-200'
                      : 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                  }`}
                >
                  {/* Step Number & Type Icon */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-mono font-bold flex items-center justify-center text-xs shadow">
                      {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                      {leg.type === 'RUN' && (
                        <>
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Loopronde</span>
                        </>
                      )}
                      {leg.type === 'SHOOT' && (
                        <>
                          <Crosshair className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300">Schieten</span>
                        </>
                      )}
                      {leg.type === 'FINISH' && (
                        <>
                          <Flag className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300">Finish</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={leg.name}
                      onChange={(e) => handleUpdateLeg(idx, { name: e.target.value })}
                      placeholder="Naam van het onderdeel"
                      className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Specific Fields depending on Leg Type */}
                  {leg.type === 'RUN' && (
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 font-semibold text-[11px] whitespace-nowrap">
                        Afstand:
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={leg.distanceMeters || 1000}
                        onChange={(e) =>
                          handleUpdateLeg(idx, { distanceMeters: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono"
                      />
                      <span className="text-slate-400 text-[11px]">m</span>
                    </div>
                  )}

                  {leg.type === 'SHOOT' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Shot count */}
                      <div className="flex items-center gap-1">
                        <label className="text-slate-400 text-[11px]">Schoten:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={leg.shotCount || 5}
                          onChange={(e) =>
                            handleUpdateLeg(idx, {
                              shotCount: parseInt(e.target.value, 10) || 5,
                              maxHits: parseInt(e.target.value, 10) || 5,
                            })
                          }
                          className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-white font-mono"
                        />
                      </div>

                      {/* Stance */}
                      <div className="flex items-center gap-1">
                        <label className="text-slate-400 text-[11px]">Houding:</label>
                        <select
                          value={leg.stance || 'prone'}
                          onChange={(e) =>
                            handleUpdateLeg(idx, { stance: e.target.value as ShootingStance })
                          }
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium"
                        >
                          <option value="prone">Liggend</option>
                          <option value="standing">Staand</option>
                          <option value="free">Vrij</option>
                        </select>
                      </div>

                      {/* Penalty */}
                      <div className="flex items-center gap-1">
                        <label className="text-slate-400 text-[11px]">Straf:</label>
                        <input
                          type="number"
                          min="0"
                          value={leg.penaltyValueSeconds ?? penaltySeconds}
                          onChange={(e) =>
                            handleUpdateLeg(idx, {
                              penaltyValueSeconds: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-amber-400 font-mono font-bold"
                        />
                        <span className="text-slate-400 text-[11px]">s</span>
                      </div>
                    </div>
                  )}

                  {leg.type === 'FINISH' && (
                    <div className="text-[11px] text-amber-300 italic font-mono">
                      Officiële T1 tijdstop
                    </div>
                  )}

                  {/* Reorder and Delete Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveLeg(idx, 'UP')}
                      title="Naar boven verplaatsen"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveLeg(idx, 'DOWN')}
                      title="Naar beneden verplaatsen"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLeg(idx)}
                      title="Verwijderen"
                      className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assigned Categories Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Leeftijdscategorieën beheren</h4>
              <p className="text-slate-400 mt-1">
                Maak zelf reeksen aan. Deelnemers vanaf 1 jaar zijn toegestaan; een maximumleeftijd is optioneel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => loadCategoryIntoForm(category)}
                  className={`px-2.5 py-1.5 rounded-lg border font-bold ${categoryId === category.id ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                >
                  {category.code}
                </button>
              ))}
              <button type="button" onClick={resetCategoryForm} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold">
                + Nieuwe categorie
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <label className="lg:col-span-2 text-slate-300 font-semibold">Naam
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="U8 Iedereen" required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-slate-300 font-semibold">Code
              <input value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} placeholder="U8" required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono" />
            </label>
            <label className="text-slate-300 font-semibold">Geslacht
              <select value={categoryGender} onChange={(event) => setCategoryGender(event.target.value as Category['gender'])} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
                <option value="ALL">Iedereen</option><option value="M">Jongens/Heren</option><option value="F">Meisjes/Dames</option>
              </select>
            </label>
            <label className="text-slate-300 font-semibold">Min. leeftijd
              <input type="number" min="1" value={categoryMinAge} onChange={(event) => setCategoryMinAge(Math.max(1, Number(event.target.value)))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-slate-300 font-semibold">Max. leeftijd
              <input type="number" min="1" value={categoryMaxAge} onChange={(event) => setCategoryMaxAge(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Geen limiet" className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="sm:col-span-2 lg:col-span-3 text-slate-300 font-semibold">Wedstrijdprofiel
              <select value={categoryProfileId} onChange={(event) => setCategoryProfileId(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
                <option value="">Nog niet gekoppeld</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button type="button" onClick={handleSaveCategory} className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-black">Categorie opslaan</button>
              {categoryId !== 'new-category' && <button type="button" onClick={handleDeleteCategory} className="px-4 py-2 rounded-lg bg-red-950/60 text-red-300 border border-red-800">Verwijderen</button>}
            </div>
          </div>
        </div>

        {/* Assigned Categories Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-3 text-xs">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" /> Categorieën die dit Profiel Gebruiken
          </h4>
          <p className="text-xs text-slate-400">
            Vink de leeftijdscategorieën aan die deze specifieke wedstrijdopbouw (afstanden en schietbeurten)
            moeten afleggen:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {categories.map((c) => {
              const isChecked = assignedCategoryIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                    isChecked
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleCategory(c.id)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <div>
                    <span className="font-bold block text-xs">{c.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Code: {c.code}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedMessage ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>Wedstrijdprofiel & volgorde succesvol opgeslagen!</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Wijzigingen worden direct van kracht op alle posten en schietstanden.
            </div>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" /> Wedstrijdprofiel Opslaan
          </button>
        </div>
      </form>
    </div>
  );
};
