import React, { useState } from 'react';
import {
  Heart,
  Activity,
  Pill,
  Syringe,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  Code,
  FileCheck,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

export default function Timeline({ data, fhirBundle, auditBlock, onDownloadPDF }) {
  const [activeTab, setActiveTab] = useState('clinical'); // 'clinical' | 'fhir' | 'audit'
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">
        <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
        <h3 className="text-lg font-medium text-slate-300">No Clinical Data Extracted Yet</h3>
        <p className="text-sm mt-1 max-w-md mx-auto">
          Record spoken on-scene notes or select a clinical preset above to run the offline Whisper and SLM pipeline.
        </p>
      </div>
    );
  }

  const { patient, vitals, medications, procedures, narrative_summary, flags_or_allergies } = data;

  const handleCopyJSON = (jsonObj) => {
    navigator.clipboard.writeText(JSON.stringify(jsonObj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 transition-all duration-300">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Structured Clinical Record
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                GBNF $O(1)$ Validated
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Auto-normalized to RxNorm & SNOMED CT standards | Edge Sealed
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('clinical')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'clinical'
                ? 'bg-cyan-500 text-black shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Clinical View
          </button>
          <button
            onClick={() => setActiveTab('fhir')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'fhir'
                ? 'bg-cyan-500 text-black shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            FHIR-lite JSON
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-cyan-500 text-black shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Audit Seal
          </button>
        </div>
      </div>

      {/* TAB 1: CLINICAL VIEW */}
      {activeTab === 'clinical' && (
        <div className="space-y-6 pt-5">
          {/* Patient Demographics Banner */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Age & Gender</span>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {patient?.age ? `${patient.age} yrs` : 'Unknown'} • {patient?.gender || 'Unspecified'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Chief Complaint</span>
              <p className="text-sm font-semibold text-amber-400 mt-0.5 truncate">
                {patient?.chief_complaint || 'Acute Emergency'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Unit Call Sign</span>
              <p className="text-sm font-semibold text-cyan-400 mt-0.5">
                {patient?.call_sign_or_unit || 'Medic 1'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Encounter ID</span>
              <p className="text-xs font-mono font-medium text-slate-300 mt-0.5 truncate">
                {patient?.incident_id || 'ENC-EDGE-PENDING'}
              </p>
            </div>
          </div>

          {/* Critical Warnings / Allergies */}
          {flags_or_allergies && flags_or_allergies.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider">Critical Clinical Alerts</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {flags_or_allergies.map((flag, idx) => (
                    <span key={idx} className="text-xs text-red-200 font-medium px-2 py-0.5 rounded bg-red-900/60 border border-red-700/50">
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Physiological Vital Signs HUD */}
          {vitals && vitals.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Heart className="w-4 h-4 text-rose-400" />
                Physiological Vitals
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {vitals[0].bp_systolic && vitals[0].bp_diastolic && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Blood Pressure</span>
                    <p className="text-base font-bold text-cyan-400 mt-0.5 font-mono">
                      {vitals[0].bp_systolic}/{vitals[0].bp_diastolic}
                      <span className="text-[10px] text-slate-500 ml-1">mmHg</span>
                    </p>
                  </div>
                )}
                {vitals[0].heart_rate && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Heart Rate</span>
                    <p className="text-base font-bold text-rose-400 mt-0.5 font-mono">
                      {vitals[0].heart_rate}
                      <span className="text-[10px] text-slate-500 ml-1">bpm</span>
                    </p>
                  </div>
                )}
                {vitals[0].spo2 && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">SpO2 Oxygen</span>
                    <p className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                      {vitals[0].spo2}%
                    </p>
                  </div>
                )}
                {vitals[0].respiratory_rate && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Respirations</span>
                    <p className="text-base font-bold text-amber-400 mt-0.5 font-mono">
                      {vitals[0].respiratory_rate}
                      <span className="text-[10px] text-slate-500 ml-1">/min</span>
                    </p>
                  </div>
                )}
                {vitals[0].gcs && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Glasgow GCS</span>
                    <p className="text-base font-bold text-purple-400 mt-0.5 font-mono">
                      {vitals[0].gcs}
                      <span className="text-[10px] text-slate-500 ml-1">/15</span>
                    </p>
                  </div>
                )}
                {vitals[0].blood_glucose && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Blood Glucose</span>
                    <p className="text-base font-bold text-blue-400 mt-0.5 font-mono">
                      {vitals[0].blood_glucose}
                      <span className="text-[10px] text-slate-500 ml-1">mg/dL</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Administered Medications */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Pill className="w-4 h-4 text-cyan-400" />
              Medications & Infusions ({medications?.length || 0})
            </h3>
            {medications && medications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {medications.map((m, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          {m.name}
                          {m.raw_term && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                              verbatim: "{m.raw_term}"
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-cyan-400 font-semibold mt-1">
                          {m.dose ? `${m.dose} ${m.unit || ''}` : 'Standard Dose'} • {m.route || 'IV Push'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 shrink-0 font-medium">
                        RxNorm
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {m.relative_time_phrase || (m.timestamp ? m.timestamp.split('T')[1]?.substring(0, 5) : 'On scene')}
                      </span>
                      {m.timestamp && (
                        <span className="text-slate-500 text-[10px] font-mono">
                          ISO: {m.timestamp.substring(11, 19)}Z
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
                No medications administered.
              </p>
            )}
          </div>

          {/* Procedures & Interventions */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Syringe className="w-4 h-4 text-emerald-400" />
              Procedures & Interventions ({procedures?.length || 0})
            </h3>
            {procedures && procedures.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {procedures.map((p, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          {p.name}
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          <b>Site / Device:</b> {p.site || 'Standard anatomic placement'}
                        </p>
                        {p.details && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {p.details}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 shrink-0 font-medium">
                        SNOMED CT
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {p.relative_time_phrase || 'En route / Scene'}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                        {p.success ? 'Confirmed' : 'Attempted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
                No invasive procedures logged.
              </p>
            )}
          </div>

          {/* Narrative Summary */}
          {narrative_summary && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Clinical Narrative Summary
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                {narrative_summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FHIR-LITE JSON BUNDLE */}
      {activeTab === 'fhir' && (
        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              HL7 FHIR R4 Document Bundle ready for interoperable Hospital ED / EHR ingress.
            </p>
            <button
              onClick={() => handleCopyJSON(fhirBundle)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Bundle' : 'Copy FHIR JSON'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 max-h-96 overflow-y-auto leading-tight selection:bg-cyan-900">
            {JSON.stringify(fhirBundle, null, 2)}
          </pre>
        </div>
      )}

      {/* TAB 3: CRYPTOGRAPHIC AUDIT SEAL */}
      {activeTab === 'audit' && (
        <div className="pt-5 space-y-4">
          {auditBlock ? (
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-slate-100">
                    Cryptographic Block Height #{auditBlock.index}
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800">
                  IMMUTABLE SHA-256
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Block Seal Hash (SHA-256)</span>
                  <p className="text-cyan-400 break-all select-all font-semibold mt-0.5">
                    {auditBlock.block_hash}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Payload Canonical Hash</span>
                  <p className="text-slate-300 break-all select-all mt-0.5">
                    {auditBlock.payload_hash}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Previous Block Hash (Chained)</span>
                  <p className="text-slate-400 break-all select-all mt-0.5">
                    {auditBlock.prev_hash}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Sealed At (UTC)</span>
                    <span className="text-slate-200">{auditBlock.timestamp}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Encounter Reference</span>
                    <span className="text-slate-200">{auditBlock.encounter_id}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300">
                <b>Tamper-Evident Guarantee:</b> Modifying any medication, procedure, or timestamp in this encounter invalidates the SHA-256 block hash and breaks the cryptographic ledger chain.
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Audit seal will be displayed once encounter is finalized.</p>
          )}
        </div>
      )}
    </div>
  );
}
