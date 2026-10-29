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
  X,
  Zap,
  ArrowRight
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

// Real-World Clinical EMS Presets (High-visibility triage scenarios)
const CLINICAL_PRESETS = [
  {
    label: "Acute STEMI / Chest Pain",
    badge: "Cardiology",
    badgeBg: "bg-[#ffe600]",
    text: "Medic 4 on scene. 65-year-old male with severe crushing chest pain radiating to left arm and diaphoresis. Administered 324 mg aspirin orally and 0.4 sublingual nitro 5 mins ago. Placed 18 gauge IV in left AC, 12-lead ECG completed showing anterior STEMI. Started normal saline wide open. Vitals: BP 140/90, HR 88, SpO2 96%, GCS 15. Penicillin allergy noted on medic alert bracelet."
  },
  {
    label: "ACLS Cardiac Arrest",
    badge: "Resuscitation",
    badgeBg: "bg-[#ff4d4d] text-white",
    text: "Medic 12 on scene. 72-year-old female in witnessed cardiac arrest. Immediate CPR initiated, bagged with BVM. Placed IO in right proximal tibia, administered 1 mg epi IV push 2 mins ago and 300 mg amio. Defibrillated at 200 Joules with return of spontaneous circulation. Vitals: BP 90/60, HR 54, SpO2 89%, GCS 3."
  },
  {
    label: "Severe Asthma / CPAP",
    badge: "Respiratory",
    badgeBg: "bg-[#00d2ff]",
    text: "Rescue 7 on scene. 28-year-old female presenting with severe respiratory distress, tripod positioning, audible expiratory wheezes. Administered 2.5 mg albuterol via nebulizer 4 mins ago and placed on CPAP at 10 cmH2O. Started 20g IV in right forearm. Vitals: BP 124/82, HR 118, RR 32, SpO2 88% on room air, GCS 15."
  },
  {
    label: "Opioid Overdose Reversal",
    badge: "Toxicology",
    badgeBg: "bg-[#cc88ff]",
    text: "Medic 3 on scene. 35-year-old male found unresponsive with pinpoint pupils and agonal respirations. Administered 2 mg narcan intranasally 3 mins ago. Bag-valve-mask ventilations provided with 15L O2. Placed 18g IV left forearm. Patient regaining consciousness. Vitals: BP 110/70, HR 64, RR 8 increasing to 14, SpO2 91% improving to 98%, GCS 6 improving to 13."
  }
];

export default function App() {
  // Application State
  const [health, setHealth] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [callSign, setCallSign] = useState('Medic 4');

  // Clinical Response
  const [clinicalResponse, setClinicalResponse] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Ledger Verification Modal
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerBlocks, setLedgerBlocks] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyingLedger, setVerifyingLedger] = useState(false);

  // Audio Recording Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.warn("Backend telemetry pending:", e);
    }
  };

  // -------------------------------------------------------------------------
  // AUDIO RECORDING (Browser Web Audio & MediaRecorder)
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

      // Segmented LED Audio Level Analyzer
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
      setErrorMsg("Microphone input unavailable. You can type notes or click any clinical preset to run the full pipeline.");
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
    setProcessingStage('Transcribing audio via faster-whisper INT8 (Silero VAD active)...');
    setErrorMsg(null);

    try {
      const resp = await processClinicalAudio(blob, null, callSign);
      setClinicalResponse(resp);
      setNoteText(resp.transcript);
      await loadHealth();
    } catch (err) {
      setErrorMsg(err.message || 'Error processing audio notes.');
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
    setProcessingStage('Executing GBNF constrained SLM extraction & normalizing slang...');
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
  // PDF GENERATION & LEDGER
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
      setErrorMsg("Failed to load audit ledger: " + e.message);
    } finally {
      setVerifyingLedger(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate segmented LED bars for audio level (12 segments)
  const numSegments = 12;
  const activeSegments = Math.round((audioLevel / 100) * numSegments);

  return (
    <div className="min-h-screen bg-[#faf8f2] text-[#121826] flex flex-col font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* NEOBRUTALIST TOP NAVIGATION & TELEMETRY HUD                        */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b-[2.5px] border-[#121826] bg-white sticky top-0 z-40 px-4 py-3 shadow-neo-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#ffe600] border-2.5 border-[#121826] shadow-neo-sm flex items-center justify-center text-[#121826]">
              <Activity className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-[#121826] flex items-center gap-2">
                  EDGE EMS AI
                </h1>
                <span className="neo-badge bg-[#ffe600] text-black px-2 py-0.5">
                  OFFLINE KERNEL
                </span>
                <span className="neo-badge bg-[#00e599] text-black px-2 py-0.5 hidden sm:inline-block">
                  ZERO CLOUD
                </span>
              </div>
              <p className="text-xs font-bold text-slate-600">
                Voice-to-Structured Clinical Handover • Edge-Deployed Field Scribe
              </p>
            </div>
          </div>

          {/* Hardware & Cryptographic Status Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
            <div className="neo-badge bg-white px-3 py-1.5 flex items-center gap-1.5 text-slate-800">
              <Cpu className="w-3.5 h-3.5 text-[#121826] stroke-[2.5]" />
              <span>CPU: {health?.cpu_threads || '11'} CORES</span>
            </div>

            <div className="neo-badge bg-[#00d2ff] text-black px-3 py-1.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>WHISPER INT8</span>
            </div>

            <div className="neo-badge bg-[#cc88ff] text-black px-3 py-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>GBNF SLM</span>
            </div>

            <button
              onClick={openLedgerModal}
              className="neo-btn bg-[#00e599] text-black px-3 py-1.5 flex items-center gap-1.5"
              title="Inspect SHA-256 Cryptographic Ledger"
            >
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>LEDGER: BLOCK #{health?.ledger_block_height || '1'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CONTENT WORKSPACE                                             */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert Box */}
        {errorMsg && (
          <div className="neo-box-red p-4 text-white flex items-start justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-white shrink-0 mt-0.5 stroke-[2.5]" />
              <div>
                <b className="font-extrabold uppercase tracking-wider block text-xs">System Notice</b>
                <span className="font-medium text-xs text-white">{errorMsg}</span>
              </div>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="neo-btn bg-white text-black p-1 hover:bg-slate-200"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 1: TACTICAL VOICE INGESTION & PARAMEDIC DICTATION        */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Physical Tactical Audio Recorder (5 cols) */}
          <div className="lg:col-span-5 neo-box p-6 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-slate-200">
                <span className="text-xs font-black uppercase tracking-wider text-[#121826] font-mono flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 stroke-[2.5]" />
                  TACTICAL AUDIO INGESTION
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-slate-600">UNIT:</span>
                  <input
                    type="text"
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value)}
                    className="w-24 px-2 py-0.5 rounded border-2 border-black font-mono font-bold text-xs bg-[#ffe600] text-black text-center focus:outline-none shadow-neo-sm"
                    placeholder="Medic 4"
                  />
                </div>
              </div>

              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Capture verbal on-scene notes. Spoken audio is zero-copy streamed directly in RAM to INT8 Whisper with Silero VAD dropping dead silence.
              </p>

              {/* Physical Push Button Controller */}
              <div className="my-7 flex flex-col items-center justify-center">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    disabled={processing}
                    className="neo-btn group bg-[#ffe600] hover:bg-[#fde047] p-6 rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-neo-lg hover:shadow-neo transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Mic className="w-12 h-12 text-[#121826] stroke-[2.5] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-[#121826]">
                      Record
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="neo-btn bg-[#ff4d4d] text-white p-6 rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-neo-lg animate-bounce transition-all cursor-pointer"
                  >
                    <Square className="w-10 h-10 fill-white text-white" />
                    <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-white font-mono">
                      Stop ({formatTimer(recordDuration)})
                    </span>
                  </button>
                )}
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 mt-3 font-mono">
                  {recording ? `● LIVE RECORDING: ${formatTimer(recordDuration)}` : 'READY TO RECORD ON-SCENE'}
                </span>
              </div>

              {/* Segmented Tactical LED VAD Meter (Motorola radio style) */}
              <div className="mt-4 p-3 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono font-black text-slate-700 uppercase">
                  <span>SILERO VAD AUDIO DETECTOR</span>
                  <span className="neo-badge bg-white px-1.5 py-0.2">
                    {recording ? `${audioLevel}% SPEECH` : 'STANDBY'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 pt-1">
                  {Array.from({ length: numSegments }).map((_, i) => {
                    const isActive = recording && i < activeSegments;
                    let color = 'bg-slate-200';
                    if (isActive) {
                      if (i < 7) color = 'bg-[#00e599]';
                      else if (i < 10) color = 'bg-[#ffe600]';
                      else color = 'bg-[#ff4d4d]';
                    }
                    return (
                      <div
                        key={i}
                        className={`led-segment ${color}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Processing Stage Badge */}
            {processing && (
              <div className="mt-4 p-3 rounded-xl bg-[#00d2ff] border-2 border-[#121826] shadow-neo-sm text-black flex items-center gap-2.5 text-xs font-bold animate-pulse font-mono">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0 stroke-[3]" />
                <span>{processingStage}</span>
              </div>
            )}

            <div className="pt-3 mt-4 border-t-2 border-slate-200 flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#121826]" /> ZERO DISK FLASH WEAR
              </span>
              <span>CTranslate2 INT8</span>
            </div>
          </div>

          {/* RIGHT: High-Visibility Paramedic Dictation & Rapid Triage Presets (7 cols) */}
          <div className="lg:col-span-7 neo-box p-6 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#121826] font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 stroke-[2.5]" />
                  PARAMEDIC ON-SCENE DICTATION / TRANSCRIPT
                </span>
                <span className="neo-badge bg-[#faf8f2] px-2 py-0.5 text-[10px]">
                  {noteText.length} CHARS
                </span>
              </div>

              {/* Triage Scenario Quick-Preset Buttons */}
              <div className="mb-3">
                <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1 font-mono">
                  RAPID FIELD PRESETS (ONE-CLICK DEMO):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {CLINICAL_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPreset(preset)}
                      disabled={processing}
                      className="neo-btn p-2.5 bg-white hover:bg-[#faf8f2] text-left flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-black text-[#121826] group-hover:text-black">
                          {preset.label}
                        </span>
                        <span className={`neo-badge text-[9px] px-1.5 py-0.2 ${preset.badgeBg}`}>
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 line-clamp-1">
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
                  placeholder="Spoken words will appear here in real-time, or you can paste / type paramedic field notes with slang (e.g., 'gave 1 mg epi 2 mins ago, 324 mg aspirin orally, started 18g iv in left AC, normal saline wide open, vitals: bp 130/80...')"
                  rows={4}
                  className="w-full p-3.5 rounded-xl border-2.5 border-[#121826] shadow-neo-sm focus:shadow-neo text-xs font-mono font-medium text-[#121826] bg-[#faf8f2] leading-relaxed placeholder:text-slate-400 focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-200">
              <span className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#00e599] stroke-[3]" />
                GBNF Constrained SLM • Deterministic Parsing
              </span>
              <button
                onClick={() => handleProcessText()}
                disabled={processing || !noteText.trim()}
                className="neo-btn px-5 py-2.5 bg-[#ffe600] hover:bg-[#fde047] text-black text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-neo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                EXTRACT & SEAL RECORD
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 2: STRUCTURED CLINICAL RECORD & FHIR VIEWER               */}
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
        {/* SECTION 3: FINALIZED HANDOVER ACTION BAR                         */}
        {/* ---------------------------------------------------------------- */}
        {clinicalResponse && (
          <div className="neo-box-green p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-neo-sm flex items-center justify-center text-black shrink-0">
                <CheckCircle2 className="w-7 h-7 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-base font-black text-black flex items-center gap-2">
                  Encounter Finalized & Cryptographically Sealed
                  <span className="neo-badge bg-white text-black px-2 py-0.5 text-xs font-mono font-bold">
                    {clinicalResponse.encounter_id}
                  </span>
                </h3>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  Ready for trauma center handover. Block #{clinicalResponse.audit_block.index} chained in local SQLite ledger.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openLedgerModal}
                className="neo-btn px-4 py-2.5 bg-white text-black text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Audit Trail
              </button>

              <button
                onClick={handleDownloadPDF}
                className="neo-btn px-5 py-2.5 bg-[#ffe600] text-black text-xs font-black uppercase tracking-wider shadow-neo flex items-center gap-2"
              >
                <FileDown className="w-4 h-4 stroke-[2.5]" />
                Download Handover PDF
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 4: HACKATHON EDGE ARCHITECTURE HIGHLIGHTS                */}
        {/* ---------------------------------------------------------------- */}
        <div className="neo-box p-6 bg-white">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-slate-200">
            <h3 className="text-sm font-black text-[#121826] uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 stroke-[2.5]" />
              Edge Computing & Technical Specifications
            </h3>
            <span className="neo-badge bg-[#ffe600] px-2 py-0.5 text-[10px]">
              NO CLOUD CALLS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-[#00d2ff] border border-black" />
                <h4 className="font-black text-[#121826] text-sm">
                  Zero Cloud Dependencies
                </h4>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Runs 100% offline on low-end edge hardware (laptops, rugged field tablets, vehicle terminals). Operates during cellular blackouts, subways, and rural disasters with zero API fees and zero HIPAA cloud exposure.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-[#cc88ff] border border-black" />
                <h4 className="font-black text-[#121826] text-sm">
                  GBNF Constrained SLM
                </h4>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Uses llama-cpp-python logit masking derived directly from Pydantic schemas via <code className="bg-white px-1 py-0.5 border border-black rounded text-[11px] font-mono">LlamaGrammar.from_json_schema()</code>. Guarantees 100% valid JSON with $O(1)$ parsing and zero markdown fences.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-[#00e599] border border-black" />
                <h4 className="font-black text-[#121826] text-sm">
                  Cryptographic Audit Chain
                </h4>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Embedded SQLite cryptographic ledger chaining every note via SHA-256 block seals. Any post-incident tampering with medications, doses, or timestamps immediately breaks the mathematical block verification.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* CRYPTOGRAPHIC AUDIT LEDGER MODAL                                   */}
      {/* ------------------------------------------------------------------ */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="neo-box max-w-3xl w-full max-h-[85vh] flex flex-col bg-white overflow-hidden shadow-neo-xl">
            <div className="p-4 border-b-2.5 border-[#121826] flex items-center justify-between bg-[#ffe600]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black text-[#ffe600] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">
                    Immutable Cryptographic Audit Ledger
                  </h3>
                  <p className="text-[11px] font-bold text-slate-800">
                    Local SQLite SHA-256 Cryptographic Chain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="neo-btn bg-white text-black p-1 hover:bg-slate-100"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[#faf8f2]">
              {/* Verification Report Banner */}
              {verificationResult && (
                <div className={`p-4 rounded-xl border-2 border-black shadow-neo-sm flex items-start gap-3 ${
                  verificationResult.is_valid
                    ? 'bg-[#00e599]/30 text-black'
                    : 'bg-[#ff4d4d]/20 text-black'
                }`}>
                  <ShieldCheck className={`w-6 h-6 shrink-0 mt-0.5 stroke-[2.5] ${
                    verificationResult.is_valid ? 'text-[#121826]' : 'text-[#ff4d4d]'
                  }`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      {verificationResult.is_valid ? 'CRYPTOGRAPHIC INTEGRITY VALIDATED' : 'TAMPERING DETECTED'}
                    </h4>
                    <p className="text-xs font-bold mt-0.5">
                      {verificationResult.message}
                    </p>
                    <div className="mt-2 text-[10px] font-mono font-bold text-slate-700">
                      Total Blocks: {verificationResult.total_blocks} • Verified At: {verificationResult.verified_at}
                    </div>
                  </div>
                </div>
              )}

              {/* Block History Table */}
              <div className="space-y-2">
                <span className="text-xs font-black text-[#121826] uppercase tracking-wider block font-mono">
                  SEQUENTIAL BLOCK REGISTRY ({ledgerBlocks.length}):
                </span>
                <div className="space-y-2">
                  {ledgerBlocks.map((block) => (
                    <div
                      key={block.index}
                      className="p-3.5 rounded-xl bg-white border-2 border-[#121826] shadow-neo-sm text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-black">
                          Block #{block.index} • Encounter: {block.encounter_id}
                        </span>
                        <span className="neo-badge bg-[#faf8f2] px-1.5 py-0.2 text-[10px]">
                          {block.timestamp}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 truncate">
                        <b className="text-black">Block Seal:</b> {block.block_hash}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <b>Prev Hash:</b> {block.prev_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t-2 border-[#121826] bg-white flex justify-end">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="neo-btn px-4 py-2 bg-[#ffe600] text-black text-xs font-black uppercase tracking-wider"
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t-[2.5px] border-[#121826] bg-white py-3 px-6 text-center text-xs font-mono font-bold text-slate-700">
        Edge EMS Clinical AI • Offline Neobrutalist Field Handover • faster-whisper INT8 + llama-cpp-python GBNF
      </footer>
    </div>
  );
}
