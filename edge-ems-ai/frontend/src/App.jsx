import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Activity,
  ShieldCheck,
  FileDown,
  RefreshCw,
  AlertCircle,
  FileText,
  Volume2,
  CheckCircle2,
  X,
  Clock,
  Send,
  ClipboardList,
  Sun,
  Moon
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

export default function App() {
  // Application State
  const [health, setHealth] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [callSign, setCallSign] = useState('Medic 4');
  const [currentTime, setCurrentTime] = useState('');

  // Dark Mode State (Persisted in localStorage, respects system default)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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

  // Synchronize dark mode class on <html> element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  useEffect(() => {
    loadHealth();
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const updateClock = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const loadHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.warn("Backend status:", e);
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

      // Discrete Segmented LED Audio Level Analyzer
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
      setErrorMsg("Microphone access unavailable. You can type on-scene notes directly.");
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
    setProcessingStage('Transcribing on-scene voice dictation...');
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
  // TEXT PROCESSING
  // -------------------------------------------------------------------------
  const handleProcessText = async (textToProcess) => {
    const text = textToProcess || noteText;
    if (!text.trim()) {
      setErrorMsg("Please enter on-scene notes or record your voice report.");
      return;
    }

    setProcessing(true);
    setProcessingStage('Extracting clinical record & standardizing medications...');
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

  // -------------------------------------------------------------------------
  // PDF GENERATION & AUDIT
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
      setErrorMsg("Failed to load audit history: " + e.message);
    } finally {
      setVerifyingLedger(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 12-segment discrete LED meter for mic input
  const numSegments = 12;
  const activeSegments = Math.round((audioLevel / 100) * numSegments);

  return (
    <div className="min-h-screen bg-[#faf8f2] dark:bg-[#0c1017] text-[#121826] dark:text-[#f1f5f9] flex flex-col font-sans transition-colors duration-200">
      {/* ------------------------------------------------------------------ */}
      {/* CLEAN CLINICAL TOP NAVIGATION BAR WITH DARK MODE SWITCH            */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b-[2.5px] border-[#121826] dark:border-[#2d3748] bg-white dark:bg-[#151c28] sticky top-0 z-40 px-4 py-3 shadow-neo-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Product Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#ffe600] border-2.5 border-[#121826] shadow-neo-sm flex items-center justify-center text-[#121826]">
              <Activity className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-[#121826] dark:text-white">
                  MEDICSCRIBE EMS
                </h1>
                <span className="neo-badge bg-[#00e599] text-black px-2 py-0.5 text-[10px]">
                  FIELD READY
                </span>
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                On-Scene Voice Dictation & Clinical Handover Generator
              </p>
            </div>
          </div>

          {/* Clean Clinician Status, Incident Controls & Top-Right Dark Mode Switch */}
          <div className="flex items-center gap-2.5">
            <div className="neo-badge bg-[#faf8f2] dark:bg-[#0f141d] px-3 py-1.5 flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>{currentTime || 'SCENE TIME'}</span>
            </div>

            {/* DARK MODE SWITCH ON TOP RIGHT CORNER */}
            <button
              onClick={toggleDarkMode}
              className="neo-btn bg-[#ffe600] dark:bg-[#2d3748] text-black dark:text-[#ffe600] p-2 flex items-center justify-center transition-all cursor-pointer"
              title={darkMode ? "Switch to Daytime / Paper Mode" : "Switch to Night / Ambulance Mode"}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <Moon className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CLINICAL WORKSPACE                                            */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert Box */}
        {errorMsg && (
          <div className="neo-box-red p-4 text-white flex items-start justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-white shrink-0 mt-0.5 stroke-[2.5]" />
              <div>
                <b className="font-extrabold uppercase tracking-wider block text-xs">Notice</b>
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
        {/* SECTION 1: VOICE DICTATION & FIELD NOTES                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Voice Dictation Controller (5 cols) */}
          <div className="lg:col-span-5 neo-box p-6 flex flex-col justify-between bg-white dark:bg-[#151c28]">
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-slate-200 dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-[#121826] dark:text-white font-mono flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 stroke-[2.5]" />
                  VOICE DICTATION
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">UNIT:</span>
                  <input
                    type="text"
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value)}
                    className="w-24 px-2 py-0.5 rounded border-2 border-black font-mono font-bold text-xs bg-[#ffe600] text-black text-center focus:outline-none shadow-neo-sm"
                    placeholder="Medic 4"
                  />
                </div>
              </div>

              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                Dictate the on-scene patient report. Speak vitals, medications, routes, and clinical procedures clearly.
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
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300 mt-3 font-mono">
                  {recording ? `● RECORDING IN PROGRESS (${formatTimer(recordDuration)})` : 'PRESS TO RECORD ON-SCENE'}
                </span>
              </div>

              {/* Segmented LED Mic Level Meter */}
              <div className="mt-4 p-3 rounded-xl bg-[#faf8f2] dark:bg-[#0f141d] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono font-black text-slate-700 dark:text-slate-300 uppercase">
                  <span>MICROPHONE INPUT</span>
                  <span className="neo-badge bg-white dark:bg-[#1f2838] px-1.5 py-0.2 text-[#121826] dark:text-white">
                    {recording ? `${audioLevel}% DETECTED` : 'READY'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 pt-1">
                  {Array.from({ length: numSegments }).map((_, i) => {
                    const isActive = recording && i < activeSegments;
                    let color = 'bg-slate-200 dark:bg-slate-800';
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
          </div>

          {/* RIGHT: Clinical On-Scene Notes Editor (7 cols) */}
          <div className="lg:col-span-7 neo-box p-6 flex flex-col justify-between bg-white dark:bg-[#151c28]">
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-slate-200 dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-[#121826] dark:text-white font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 stroke-[2.5]" />
                  CLINICAL ON-SCENE NOTES
                </span>
                <div className="flex items-center gap-2">
                  {noteText.trim() && (
                    <button
                      onClick={() => setNoteText('')}
                      className="text-[11px] font-bold text-slate-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <span className="neo-badge bg-[#faf8f2] dark:bg-[#0f141d] px-2 py-0.5 text-[10px] text-slate-800 dark:text-slate-300">
                    {noteText.length} CHARACTERS
                  </span>
                </div>
              </div>

              {/* Note Textarea */}
              <div className="relative">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Spoken words will appear here automatically as you dictate, or you can paste / type on-scene clinical notes directly.&#10;&#10;Example:&#10;Medic 4 on scene. 65-year-old male with severe chest pain. Administered 324 mg aspirin orally and 0.4 sublingual nitro 5 mins ago. Placed 18g IV left AC, 12-lead ECG completed. Normal saline wide open. Vitals: BP 140/90, HR 88, SpO2 96%."
                  rows={9}
                  className="w-full p-4 rounded-xl border-2.5 border-[#121826] dark:border-[#2d3748] shadow-neo-sm focus:shadow-neo text-xs font-mono font-medium text-[#121826] dark:text-white bg-[#faf8f2] dark:bg-[#0f141d] leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Standardizes EMS terminology and resolves relative times automatically.
              </span>
              <button
                onClick={() => handleProcessText()}
                disabled={processing || !noteText.trim()}
                className="neo-btn px-5 py-2.5 bg-[#ffe600] hover:bg-[#fde047] text-black text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-neo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 stroke-[2.5]" />}
                PROCESS CLINICAL REPORT
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
                  Clinical Handover Document Finalized
                  <span className="neo-badge bg-white text-black px-2 py-0.5 text-xs font-mono font-bold">
                    {clinicalResponse.encounter_id}
                  </span>
                </h3>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  Ready for receiving emergency department handover. Document cryptographically sealed.
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
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* HANDOVER AUDIT & VERIFICATION MODAL                                */}
      {/* ------------------------------------------------------------------ */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="neo-box max-w-3xl w-full max-h-[85vh] flex flex-col bg-white dark:bg-[#151c28] overflow-hidden shadow-neo-xl border-2.5 border-[#121826] dark:border-[#2d3748]">
            <div className="p-4 border-b-2.5 border-[#121826] dark:border-[#2d3748] flex items-center justify-between bg-[#ffe600] text-black">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black text-[#ffe600] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">
                    Handover Audit & Integrity Registry
                  </h3>
                  <p className="text-[11px] font-bold text-slate-800">
                    Tamper-Evident Prehospital Incident Records
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

            <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[#faf8f2] dark:bg-[#0f141d]">
              {/* Verification Report Banner */}
              {verificationResult && (
                <div className={`p-4 rounded-xl border-2 border-black dark:border-[#2d3748] shadow-neo-sm flex items-start gap-3 ${
                  verificationResult.is_valid
                    ? 'bg-[#00e599]/30 text-black dark:text-white'
                    : 'bg-[#ff4d4d]/20 text-black dark:text-white'
                }`}>
                  <ShieldCheck className={`w-6 h-6 shrink-0 mt-0.5 stroke-[2.5] ${
                    verificationResult.is_valid ? 'text-[#121826] dark:text-[#00e599]' : 'text-[#ff4d4d]'
                  }`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      {verificationResult.is_valid ? 'INCIDENT INTEGRITY VALIDATED' : 'DISCREPANCY DETECTED'}
                    </h4>
                    <p className="text-xs font-bold mt-0.5">
                      {verificationResult.message}
                    </p>
                    <div className="mt-2 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-400">
                      Total Documented Incidents: {verificationResult.total_blocks} • Verified At: {verificationResult.verified_at}
                    </div>
                  </div>
                </div>
              )}

              {/* Block History Table */}
              <div className="space-y-2">
                <span className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider block font-mono">
                  LOGGED INCIDENT ENCOUNTERS ({ledgerBlocks.length}):
                </span>
                <div className="space-y-2">
                  {ledgerBlocks.map((block) => (
                    <div
                      key={block.index}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#1a2232] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-black dark:text-white">
                          Encounter: {block.encounter_id}
                        </span>
                        <span className="neo-badge bg-[#faf8f2] dark:bg-[#0f141d] px-1.5 py-0.2 text-[10px] text-slate-800 dark:text-slate-300">
                          {block.timestamp}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        <b className="text-black dark:text-white">Security Seal:</b> {block.block_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t-2 border-[#121826] dark:border-[#2d3748] bg-white dark:bg-[#151c28] flex justify-end">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="neo-btn px-4 py-2 bg-[#ffe600] text-black text-xs font-black uppercase tracking-wider"
              >
                Close Audit Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CLEAN MEDICAL PRODUCT FOOTER                                       */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t-[2.5px] border-[#121826] dark:border-[#2d3748] bg-white dark:bg-[#151c28] py-3.5 px-6 text-center text-xs font-bold text-slate-600 dark:text-slate-400 transition-colors duration-200">
        MedicScribe EMS • Prehospital Electronic Handover System • NEMSIS & HL7 Field Compatible
      </footer>
    </div>
  );
}
