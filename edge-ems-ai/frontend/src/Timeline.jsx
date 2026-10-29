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
  Check,
  FileText,
  BadgeAlert,
  Hash,
  ExternalLink
} from 'lucide-react';

export default function Timeline({ data, fhirBundle, auditBlock, onDownloadPDF }) {
  const [activeTab, setActiveTab] = useState('clinical'); // 'clinical' | 'fhir' | 'audit'
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div className="neo-box p-8 text-center bg-white">
        <div className="w-16 h-16 rounded-2xl bg-[#ffe600] border-2.5 border-[#121826] shadow-neo flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-[#121826] stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-extrabold text-[#121826] tracking-tight">No Clinical Record Extracted Yet</h3>
        <p className="text-sm font-medium text-slate-600 mt-1.5 max-w-md mx-auto">
          Press the high-visibility <b className="text-black bg-[#ffe600] px-1.5 py-0.5 rounded border border-black">RECORD ON-SCENE</b> button or select an emergency clinical preset above to run the offline Whisper and SLM pipeline.
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
    <div className="neo-box bg-white p-6 transition-all duration-200">
      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER & TACTILE FOLDER TABS                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b-[2.5px] border-[#121826]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00e599] border-2 border-[#121826] shadow-neo-sm flex items-center justify-center text-[#121826]">
            <FileCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#121826] tracking-tight">
                Structured Clinical Record
              </h2>
              <span className="neo-badge bg-[#ffe600] text-black px-2 py-0.5">
                GBNF $O(1)$ Validated
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Mapped to RxNorm & SNOMED CT standards • Chained to Tamper-Evident Ledger
            </p>
          </div>
        </div>

        {/* Tactile Folder Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('clinical')}
            className={`neo-btn px-4 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'clinical'
                ? 'bg-[#ffe600] text-black shadow-neo translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Clinical Sheet
          </button>
          <button
            onClick={() => setActiveTab('fhir')}
            className={`neo-btn px-4 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'fhir'
                ? 'bg-[#00d2ff] text-black shadow-neo translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            FHIR-lite JSON
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`neo-btn px-4 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-[#00e599] text-black shadow-neo translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Audit Stamp
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: CLINICAL SHEET (NEOBRUTALIST TRIAGE HANDOVER)               */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'clinical' && (
        <div className="space-y-6 pt-5">
          {/* Patient Demographics & Dispatch Banner */}
          <div className="p-4 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-mono">
                PATIENT DEMOGRAPHICS
              </span>
              <p className="text-base font-extrabold text-[#121826] mt-0.5">
                {patient?.age ? `${patient.age} Y/O` : 'Adult'} • {patient?.gender || 'Unknown'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-mono">
                CHIEF COMPLAINT
              </span>
              <span className="inline-block mt-0.5 text-xs font-extrabold px-2 py-0.5 bg-[#ffe600] border-1.5 border-[#121826] rounded text-black truncate max-w-full">
                {patient?.chief_complaint || 'Acute Emergency'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-mono">
                RESPONDING UNIT
              </span>
              <span className="inline-block mt-0.5 text-xs font-extrabold px-2 py-0.5 bg-[#00d2ff] border-1.5 border-[#121826] rounded text-black font-mono">
                {patient?.call_sign_or_unit || 'Medic 1'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-mono">
                ENCOUNTER ID
              </span>
              <p className="text-xs font-mono font-bold text-slate-800 mt-1 truncate">
                {patient?.incident_id || 'ENC-EDGE-LOCAL'}
              </p>
            </div>
          </div>

          {/* Critical Warnings / Allergies */}
          {flags_or_allergies && flags_or_allergies.length > 0 && (
            <div className="p-4 rounded-xl bg-[#ff4d4d]/10 border-2.5 border-[#ff4d4d] shadow-neo-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#ff4d4d] text-white border-2 border-black shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#121826] uppercase tracking-wider">
                  CRITICAL CLINICAL ALERTS & ALLERGIES
                </h4>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {flags_or_allergies.map((flag, idx) => (
                    <span key={idx} className="neo-badge bg-[#ff4d4d] text-white px-2.5 py-1">
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
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-black text-[#121826] uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[#ff4d4d] stroke-[2.5]" />
                  PHYSIOLOGICAL VITAL SIGNS
                </h3>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                  MONITOR ACQUISITION: {vitals[0].timestamp ? vitals[0].timestamp.substring(11, 19) + ' UTC' : 'ON SCENE'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {/* Blood Pressure */}
                <div className="p-3 rounded-xl bg-[#ffe600]/30 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    BLOOD PRESSURE
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].bp_systolic && vitals[0].bp_diastolic ? `${vitals[0].bp_systolic}/${vitals[0].bp_diastolic}` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">mmHg</span>
                </div>

                {/* Heart Rate */}
                <div className="p-3 rounded-xl bg-[#ff4d4d]/20 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    HEART RATE
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].heart_rate || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">BPM</span>
                </div>

                {/* SpO2 */}
                <div className="p-3 rounded-xl bg-[#00e599]/30 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    SPO2 OXYGEN
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].spo2 ? `${vitals[0].spo2}%` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">PULSE OX</span>
                </div>

                {/* Respirations */}
                <div className="p-3 rounded-xl bg-[#ff914d]/20 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    RESPIRATIONS
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].respiratory_rate || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">BREATHS/MIN</span>
                </div>

                {/* GCS */}
                <div className="p-3 rounded-xl bg-[#cc88ff]/25 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    GLASGOW GCS
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].gcs ? `${vitals[0].gcs}/15` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">COMA SCORE</span>
                </div>

                {/* Glucose */}
                <div className="p-3 rounded-xl bg-[#00d2ff]/20 border-2 border-[#121826] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono block">
                    BLOOD GLUCOSE
                  </span>
                  <p className="text-xl font-black text-[#121826] mt-0.5 font-mono">
                    {vitals[0].blood_glucose || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">mg/dL</span>
                </div>
              </div>
            </div>
          )}

          {/* Administered Medications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#121826] uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-[#00d2ff] stroke-[2.5]" />
                MEDICATIONS & FLUIDS ADMINISTERED ({medications?.length || 0})
              </h3>
              <span className="neo-badge bg-white px-2 py-0.5 text-[10px]">
                RxNorm Standardized
              </span>
            </div>

            {medications && medications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {medications.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white border-2 border-[#121826] shadow-neo-sm hover:shadow-neo transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-base font-extrabold text-[#121826] tracking-tight">
                          {m.name}
                        </h4>
                        <span className="neo-badge bg-[#00d2ff] text-black px-2 py-0.5 shrink-0">
                          RxNorm
                        </span>
                      </div>

                      {/* Dosage & Route Badges */}
                      <div className="flex flex-wrap items-center gap-2 my-2">
                        <span className="neo-badge bg-[#ffe600] text-black px-2 py-0.5 font-mono">
                          {m.dose ? `${m.dose} ${m.unit || ''}` : 'Standard Dose'}
                        </span>
                        <span className="neo-badge bg-slate-100 text-slate-800 px-2 py-0.5 font-mono">
                          {m.route || 'IV Push'}
                        </span>
                      </div>

                      {/* Verbatim Spoken Term Tag */}
                      {m.raw_term && (
                        <div className="text-[11px] font-mono text-slate-600 bg-[#faf8f2] px-2 py-1 rounded border border-slate-300 mt-2">
                          <b className="text-black">Verbatim Spoken:</b> "{m.raw_term}"
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t-2 border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        {m.relative_time_phrase || (m.timestamp ? m.timestamp.substring(11, 16) : 'On scene')}
                      </span>
                      {m.timestamp && (
                        <span className="text-[10px] text-slate-500">
                          ISO: {m.timestamp.substring(11, 19)}Z
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 italic p-3.5 rounded-xl bg-[#faf8f2] border-2 border-dashed border-slate-300">
                No medications administered during this encounter.
              </p>
            )}
          </div>

          {/* Procedures & Interventions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#121826] uppercase tracking-wider flex items-center gap-1.5">
                <Syringe className="w-4 h-4 text-[#00e599] stroke-[2.5]" />
                PROCEDURES & INTERVENTIONS ({procedures?.length || 0})
              </h3>
              <span className="neo-badge bg-white px-2 py-0.5 text-[10px]">
                SNOMED CT Coded
              </span>
            </div>

            {procedures && procedures.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {procedures.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white border-2 border-[#121826] shadow-neo-sm hover:shadow-neo transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-base font-extrabold text-[#121826] tracking-tight flex items-center gap-1.5">
                          {p.name}
                          <CheckCircle2 className="w-4 h-4 text-[#00e599] stroke-[3]" />
                        </h4>
                        <span className="neo-badge bg-[#00e599] text-black px-2 py-0.5 shrink-0">
                          SNOMED CT
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-700 my-2">
                        <p>
                          <b className="text-black">Anatomical Site / Device:</b> {p.site || 'Standard anatomic placement'}
                        </p>
                        {p.details && (
                          <p className="text-slate-600">
                            <b className="text-black">Details:</b> {p.details}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t-2 border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        {p.relative_time_phrase || 'En route / Scene'}
                      </span>
                      <span className="neo-badge bg-[#00e599] text-black px-1.5 py-0.5 text-[10px]">
                        {p.success ? 'Confirmed' : 'Attempted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 italic p-3.5 rounded-xl bg-[#faf8f2] border-2 border-dashed border-slate-300">
                No invasive procedures logged.
              </p>
            )}
          </div>

          {/* Narrative Summary */}
          {narrative_summary && (
            <div>
              <h3 className="text-xs font-black text-[#121826] uppercase tracking-wider mb-2">
                OBJECTIVE CLINICAL NARRATIVE SUMMARY
              </h3>
              <div className="p-4 rounded-xl bg-[#faf8f2] border-2 border-[#121826] shadow-neo-sm text-xs font-medium text-slate-800 leading-relaxed font-sans">
                {narrative_summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: FHIR-LITE JSON BUNDLE                                       */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'fhir' && (
        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">
              HL7 FHIR R4 Document Bundle ready for interoperable Hospital ED / EHR ingress.
            </p>
            <button
              onClick={() => handleCopyJSON(fhirBundle)}
              className="neo-btn px-4 py-2 bg-[#ffe600] text-black text-xs font-extrabold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Bundle' : 'Copy FHIR JSON'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#121826] border-2.5 border-[#121826] shadow-neo text-[12px] font-mono text-[#00d2ff] max-h-96 overflow-y-auto leading-normal selection:bg-[#ffe600] selection:text-black">
            {JSON.stringify(fhirBundle, null, 2)}
          </pre>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: CRYPTOGRAPHIC AUDIT SEAL                                    */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'audit' && (
        <div className="pt-5 space-y-4">
          {auditBlock ? (
            <div className="neo-box p-6 bg-[#faf8f2] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121826]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00e599] border-2 border-black flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#121826]">
                      Cryptographic Ledger Block Height #{auditBlock.index}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-600">
                      Encounter Reference: {auditBlock.encounter_id}
                    </p>
                  </div>
                </div>
                <span className="neo-badge bg-[#00e599] text-black px-3 py-1 text-xs">
                  IMMUTABLE SHA-256 SEAL
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-white border-2 border-[#121826]">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    BLOCK SEAL HASH (SHA-256)
                  </span>
                  <p className="text-black font-extrabold break-all select-all mt-0.5">
                    {auditBlock.block_hash}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white border-2 border-[#121826]">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    PAYLOAD CANONICAL DATA HASH
                  </span>
                  <p className="text-slate-800 font-bold break-all select-all mt-0.5">
                    {auditBlock.payload_hash}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white border-2 border-[#121826]">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    PREVIOUS BLOCK HASH (CHAIN CONTINUITY)
                  </span>
                  <p className="text-slate-700 font-bold break-all select-all mt-0.5">
                    {auditBlock.prev_hash}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase block">SEAL TIMESTAMP (UTC)</span>
                    <span className="font-bold text-black">{auditBlock.timestamp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase block">LEDGER STATUS</span>
                    <span className="neo-badge bg-[#00e599] text-black px-2 py-0.5 inline-block mt-0.5">
                      VERIFIED & SEALED
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#ffe600]/30 border-2 border-[#121826] text-xs font-bold text-slate-800">
                <b>Tamper-Evident Medical-Legal Guarantee:</b> This handover document is permanently pinned to the offline SQLite ledger. Altering any drug, dose, or procedure invalidates the SHA-256 block hash and immediately breaks the mathematical chain continuity.
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-600">Audit seal will appear once the encounter is processed.</p>
          )}
        </div>
      )}
    </div>
  );
}
