import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Activity,
  ShieldCheck,
  FileDown,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Database,
  Radio,
  FileText,
  Volume2,
  Lock,
  CheckCircle2,
  X
} from 'lucide-react';

import {
  fetchHealth,
  processClinicalAudio,
  processClinicalText,
  downloadHandoverPDF,
  fetchLedger,
  verifyLedgerChain
} from './api';

import Timeline from './Timeline';

// Standard Clinical Scenarios for Rapid Field/Hackathon Demos
const CLINICAL_PRESETS = [
  {
    label: "Acute STEMI / Chest Pain",
    badge: "Cardiology",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    text: "Medic 4 on scene. 65-year-old male with severe crushing chest pain radiating to left arm and diaphoresis. Administered 324 mg aspirin orally and 0.4 sublingual nitro 5 mins ago. Placed 18 gauge IV in left AC, 12-lead ECG completed showing anterior STEMI. Started normal saline wide open. Vitals: BP 140/90, HR 88, SpO2 96%, GCS 15. Penicillin allergy noted on medic alert bracelet."
  },
  {
    label: "ACLS Cardiac Arrest",
    badge: "Resuscitation",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
    text: "Medic 12 on scene. 72-year-old female in witnessed cardiac arrest. Immediate CPR initiated, bagged with BVM. Placed IO in right proximal tibia, administered 1 mg epi IV push 2 mins ago and 300 mg amio. Defibrillated at 200 Joules with return of spontaneous circulation. Vitals: BP 90/60, HR 54, SpO2 89%, GCS 3."
  },
  {
    label: "Severe Asthma / CPAP",
    badge: "Respiratory",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    text: "Rescue 7 on scene. 28-year-old female presenting with severe respiratory distress, tripod positioning, audible expiratory wheezes. Administered 2.5 mg albuterol via nebulizer 4 mins ago and placed on CPAP at 10 cmH2O. Started 20g IV in right forearm. Vitals: BP 124/82, HR 118, RR 32, SpO2 88% on room air, GCS 15."
  },
  {
    label: "Opioid Overdose Reversal",
    badge: "Toxicology",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    text: "Medic 3 on scene. 35-year-old male found unresponsive with pinpoint pupils and agonal respirations. Administered 2 mg narcan intranasally 3 mins ago. Bag-valve-mask ventilations provided with 15L O2. Placed 18g IV left forearm. Patient regaining consciousness. Vitals: BP 110/70, HR 64, RR 8 increasing to 14, SpO2 91% improving to 98%, GCS 6 improving to 13."
  }
];

export default function App() {
  // State
  const [health, setHealth] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [callSign, setCallSign] = useState('Medic 4');
  
  // Clinical output state
  const [clinicalResponse, setClinicalResponse] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Ledger verification modal
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerBlocks, setLedgerBlocks] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyingLedger, setVerifyingLedger] = useState(false);

  // Audio recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const animFrameRef = useRef(null);

  // Initial load: Fetch health telemetry
  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.warn("Backend not reachable yet:", e);
    }
  };

  // -------------------------------------------------------------------------
  // AUDIO RECORDING LOGIC (Browser Web Audio & MediaRecorder)
  // -------------------------------------------------------------------------
  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    setRecordDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Setup audio analyzer for live waveform pulsation
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((acc, v) => acc + v, 0) / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleProcessAudioBlob(audioBlob);
      };

      mediaRecorder.start(250);
      setRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone access denied or unsupported in this browser. You can type notes or use the emergency presets below.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      clearInterval(timerIntervalRef.current);
      mediaRecorderRef.current.stop();
      setRecording(false);
      setAudioLevel(0);
    }
  };

  const handleProcessAudioBlob = async (blob) => {
    setProcessing(true);
    setProcessingStage('Ingesting Audio (Zero-Copy) • INT8 Whisper ASR with Silero VAD...');
    setErrorMsg(null);

    try {
      const resp = await processClinicalAudio(blob, null, callSign);
      setClinicalResponse(resp);
      setNoteText(resp.transcript);
      await loadHealth();
    } catch (err) {
      setErrorMsg(err.message || 'Error processing speech audio.');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  // -------------------------------------------------------------------------
  // TEXT & PRESET PROCESSING
  // -------------------------------------------------------------------------
  const handleProcessText = async (textToProcess) => {
    const text = textToProcess || noteText;
    if (!text.trim()) {
      setErrorMsg("Please enter clinical notes or select a preset.");
      return;
    }

    setProcessing(true);
    setProcessingStage('Running Local SLM with GBNF JSON Grammar Constraints...');
    setErrorMsg(null);

    try {
      const resp = await processClinicalText(text, null, callSign);
      setClinicalResponse(resp);
      await loadHealth();
    } catch (err) {
      setErrorMsg(err.message || 'Error processing clinical notes.');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  const loadPreset = (preset) => {
    setNoteText(preset.text);
    handleProcessText(preset.text);
  };

  // -------------------------------------------------------------------------
  // PDF GENERATION & LEDGER INSPECTION
  // -------------------------------------------------------------------------
  const handleDownloadPDF = async () => {
    if (!clinicalResponse) return;
    try {
      await downloadHandoverPDF(
        clinicalResponse.clinical_data,
        clinicalResponse.audit_block,
        clinicalResponse.encounter_id,
        callSign
      );
    } catch (e) {
      setErrorMsg("Failed to download handover PDF: " + e.message);
    }
  };

  const openLedgerModal = async () => {
    setShowLedgerModal(true);
    setVerifyingLedger(true);
    try {
      const [history, verification] = await Promise.all([
        fetchLedger(30),
        verifyLedgerChain()
      ]);
      setLedgerBlocks(history);
      setVerificationResult(verification);
    } catch (e) {
      setErrorMsg("Failed to load ledger: " + e.message);
    } finally {
      setVerifyingLedger(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* TOP EMERGENCY HUD HEADER */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-black">
              <Activity className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  EDGE EMS AI
                  <span className="text-cyan-400 font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">
                    OFFLINE KERNEL
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Voice-to-Structured Clinical Note Generator • Zero Cloud Dependencies
              </p>
            </div>
          </div>

          {/* Real-time Hardware / Edge Status HUD */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">CPU SIMD:</span>
              <span className="text-slate-200 font-semibold">{health?.cpu_threads || '11'} Cores</span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Whisper:</span>
              <span className="text-emerald-400 font-semibold">INT8 + Silero VAD</span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">SLM:</span>
              <span className="text-purple-400 font-semibold">GBNF Grammar</span>
            </div>

            <button
              onClick={openLedgerModal}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer group"
              title="Inspect SHA-256 Ledger"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-slate-400">Ledger:</span>
              <span className="text-emerald-400 font-semibold">
                Block #{health?.ledger_block_height || '1'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CONTENT AREA */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert if any */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 flex items-start justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <b className="font-semibold text-red-300">Notice:</b> {errorMsg}
              </div>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 1: FIELD AUDIO INGESTION & TACTICAL DICTATION */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Live Audio Recorder & Controller (5 cols) */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
            {/* Background glow on recording */}
            {recording && (
              <div className="absolute inset-0 bg-red-500/5 pointer-events-none transition-opacity animate-pulse" />
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" />
                  Tactical Audio Ingestion
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Unit:</span>
                  <input
                    type="text"
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value)}
                    className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 text-center focus:outline-none focus:border-cyan-500"
                    placeholder="Medic 1"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Speaks directly into the rugged terminal. 16kHz audio is routed in-memory (zero copy) to INT8 faster-whisper with Silero VAD dropping dead silence.
              </p>

              {/* Big On-Scene Record Button */}
              <div className="my-8 flex flex-col items-center justify-center">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    disabled={processing}
                    className="relative group cursor-pointer focus:outline-none"
                  >
                    <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 group-hover:from-cyan-500 group-hover:to-blue-400 flex items-center justify-center shadow-xl shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-all duration-300 transform group-hover:scale-105">
                      <Mic className="w-12 h-12 text-black stroke-[2.5]" />
                    </div>
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-slate-300 tracking-wider uppercase group-hover:text-cyan-400 transition-colors">
                      Record On-Scene
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="relative cursor-pointer focus:outline-none recording-pulse"
                  >
                    <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-xl shadow-red-500/40 transform scale-105">
                      <Square className="w-10 h-10 text-white fill-white" />
                    </div>
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-red-400 tracking-wider uppercase font-mono">
                      Stop & Process ({formatTimer(recordDuration)})
                    </span>
                  </button>
                )}
              </div>

              {/* Live Audio Level Meter */}
              {recording && (
                <div className="mt-8 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>SILERO VAD LEVEL</span>
                    <span className="text-red-400">{audioLevel}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-amber-500 to-red-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Processing Stage Indicator */}
            {processing && (
              <div className="mt-6 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 flex items-center gap-3 text-xs animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span className="font-mono">{processingStage}</span>
              </div>
            )}

            <div className="pt-4 mt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>ZERO DISK I/O: RAM-STREAMED</span>
              <span>CTranslate2 INT8</span>
            </div>
          </div>

          {/* RIGHT: Rapid Presets & Dictation Editor (7 cols) */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Paramedic Dictation Transcript / Field Notes
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {noteText.length} chars
                </span>
              </div>

              {/* Preset Scenarios Buttons */}
              <div className="mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Field Demo Presets (One-Click Test):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {CLINICAL_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPreset(preset)}
                      disabled={processing}
                      className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                          {preset.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${preset.badgeColor}`}>
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {preset.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Textarea */}
              <div className="relative mt-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Paramedic notes will appear here in real-time as spoken, or you can paste / type notes with medical slang (e.g., 'gave 1 mg epi 2 mins ago, 324 mg aspirin orally, started 18g iv in left AC, normal saline wide open, vitals: bp 130/80...')"
                  rows={4}
                  className="w-full p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs text-slate-200 font-mono leading-relaxed placeholder:text-slate-600 focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                GBNF Constrained SLM • RxNorm & SNOMED CT
              </span>
              <button
                onClick={() => handleProcessText()}
                disabled={processing || !noteText.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                {processing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Extract & Seal Record
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 2: STRUCTURED CLINICAL TIMELINE & FHIR VIEWER */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-4">
          <Timeline
            data={clinicalResponse?.clinical_data}
            fhirBundle={clinicalResponse?.fhir_bundle}
            auditBlock={clinicalResponse?.audit_block}
            onDownloadPDF={handleDownloadPDF}
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 3: ACTION BAR & PDF GENERATION */}
        {/* ---------------------------------------------------------------- */}
        {clinicalResponse && (
          <div className="glass-panel-success rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Encounter Finalized & Cryptographically Sealed
                  <span className="text-xs font-mono font-normal text-emerald-300">
                    ({clinicalResponse.encounter_id})
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Ready for hospital triage handover. Block #{clinicalResponse.audit_block.index} chained in local SQLite.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openLedgerModal}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Audit Trail
              </button>

              <button
                onClick={handleDownloadPDF}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4 stroke-[2.5]" />
                Download Handover PDF
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 4: HACKATHON EDGE ARCHITECTURE HIGHLIGHT CARD */}
        {/* ---------------------------------------------------------------- */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Edge Computing & Hackathon Architecture Highlights
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="font-bold text-slate-200 flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Zero Cloud Dependencies
              </h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Runs 100% offline in disconnected ambulances, aircraft, and rural disaster zones. Eliminates expensive API per-minute costs and HIPAA cloud transmission liabilities.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="font-bold text-slate-200 flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                GBNF Constrained Decoding
              </h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Forces llama-cpp-python logit masking directly from Pydantic schemas. Guarantees 100% syntactically valid JSON with $O(1)$ parsing and zero markdown hallucinations.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="font-bold text-slate-200 flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Cryptographic Audit Ledger
              </h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                SHA-256 blockchain-style chaining on local SQLite. Every medication and vital is pinned; any post-incident tampering immediately breaks the mathematical block seal.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* LEDGER AUDIT & VERIFICATION MODAL */}
      {/* ------------------------------------------------------------------ */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Local Cryptographic Audit Ledger (SHA-256)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Immutable SQLite Event Ledger • Mathematical Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Verification Result Banner */}
              {verificationResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  verificationResult.is_valid
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}>
                  <ShieldCheck className={`w-6 h-6 shrink-0 mt-0.5 ${
                    verificationResult.is_valid ? 'text-emerald-400' : 'text-red-400'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {verificationResult.is_valid ? 'Cryptographic Integrity Validated' : 'Tampering Detected'}
                    </h4>
                    <p className="text-xs mt-0.5">
                      {verificationResult.message}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-slate-400">
                      Total Blocks: {verificationResult.total_blocks} • Verified At: {verificationResult.verified_at}
                    </div>
                  </div>
                </div>
              )}

              {/* Block History Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Sequential Block Records ({ledgerBlocks.length}):
                </span>
                <div className="space-y-2">
                  {ledgerBlocks.map((block) => (
                    <div
                      key={block.index}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400">
                          Block #{block.index} ({block.encounter_id})
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {block.timestamp}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        <b className="text-slate-500">Seal:</b> <span className="text-slate-300">{block.block_hash}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <b>Prev:</b> {block.prev_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Edge EMS Clinical AI • Low-Power Offline Hardware Architecture • faster-whisper INT8 + llama-cpp-python GBNF
      </footer>
    </div>
  );
}
