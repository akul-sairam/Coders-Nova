import React from 'react';
import {
  Heart,
  Activity,
  Pill,
  Syringe,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function Timeline({ data, fhirBundle, auditBlock, onDownloadPDF }) {

  if (!data) {
    return (
      <div className="neo-box p-8 text-center bg-white dark:bg-[#151c28] border-2.5 border-[#121826] dark:border-[#2d3748] transition-colors duration-200">
        <div className="w-16 h-16 rounded-2xl bg-[#ffe600] border-2.5 border-[#121826] shadow-neo flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-[#121826] stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-extrabold text-[#121826] dark:text-white tracking-tight">No Patient Record Processed Yet</h3>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1.5 max-w-md mx-auto">
          Press <b className="text-black bg-[#ffe600] px-1.5 py-0.5 rounded border border-black">RECORD</b> above to dictate notes, or type into the clinical notes editor to generate the handover report.
        </p>
      </div>
    );
  }

  const { patient, vitals, medications, procedures, narrative_summary, flags_or_allergies } = data;

  return (
    <div className="neo-box bg-white dark:bg-[#151c28] border-2.5 border-[#121826] dark:border-[#2d3748] p-6 transition-colors duration-200">
      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER & TACTILE FOLDER TABS                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b-[2.5px] border-[#121826] dark:border-[#2d3748]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00e599] border-2 border-[#121826] shadow-neo-sm flex items-center justify-center text-[#121826]">
            <FileCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#121826] dark:text-white tracking-tight">
                Patient Handover Report
              </h2>
              <span className="neo-badge bg-[#00e599] text-black px-2 py-0.5">
                VERIFIED
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              Standardized Clinical Handover Documentation • Sealed Prehospital Record
            </p>
          </div>
        </div>

        {/* Clinical Sheet Indicator */}
        <div className="flex items-center gap-2">
          <span className="neo-badge bg-[#ffe600] text-black px-3.5 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-neo-sm">
            <FileText className="w-3.5 h-3.5" />
            Clinical Sheet
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CLINICAL HANDOVER SHEET                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-6 pt-5">
          {/* Patient Demographics & Dispatch Banner */}
          <div className="p-4 rounded-xl bg-[#faf8f2] dark:bg-[#0f141d] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block font-mono">
                PATIENT DEMOGRAPHICS
              </span>
              <p className="text-base font-extrabold text-[#121826] dark:text-white mt-0.5">
                {patient?.age ? `${patient.age} Y/O` : 'Adult'} • {patient?.gender || 'Unknown'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block font-mono">
                CHIEF COMPLAINT
              </span>
              <span className="inline-block mt-0.5 text-xs font-extrabold px-2 py-0.5 bg-[#ffe600] border-1.5 border-[#121826] rounded text-black truncate max-w-full">
                {patient?.chief_complaint || 'Acute Presentation'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block font-mono">
                RESPONDING UNIT
              </span>
              <span className="inline-block mt-0.5 text-xs font-extrabold px-2 py-0.5 bg-[#00d2ff] border-1.5 border-[#121826] rounded text-black font-mono">
                {patient?.call_sign_or_unit || 'Medic 1'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block font-mono">
                ENCOUNTER REF
              </span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {patient?.incident_id || 'ENC-PENDING'}
              </p>
            </div>
          </div>

          {/* Critical Clinical Alerts & Allergies */}
          {flags_or_allergies && flags_or_allergies.length > 0 && (
            <div className="p-4 rounded-xl bg-[#ff4d4d]/10 dark:bg-[#ff4d4d]/20 border-2.5 border-[#ff4d4d] shadow-neo-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#ff4d4d] text-white border-2 border-black shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider">
                  CRITICAL ALERTS & ALLERGIES
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
                <h3 className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[#ff4d4d] stroke-[2.5]" />
                  PHYSIOLOGICAL VITAL SIGNS
                </h3>
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                  RECORDED: {vitals[0].timestamp ? vitals[0].timestamp.substring(11, 16) : 'ON SCENE'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {/* Blood Pressure */}
                <div className="p-3 rounded-xl bg-[#ffe600]/30 dark:bg-[#ffe600]/20 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    BLOOD PRESSURE
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].bp_systolic && vitals[0].bp_diastolic ? `${vitals[0].bp_systolic}/${vitals[0].bp_diastolic}` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">mmHg</span>
                </div>

                {/* Heart Rate */}
                <div className="p-3 rounded-xl bg-[#ff4d4d]/20 dark:bg-[#ff4d4d]/25 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    HEART RATE
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].heart_rate || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">BPM</span>
                </div>

                {/* SpO2 */}
                <div className="p-3 rounded-xl bg-[#00e599]/30 dark:bg-[#00e599]/20 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    SPO2 OXYGEN
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].spo2 ? `${vitals[0].spo2}%` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">PULSE OX</span>
                </div>

                {/* Respirations */}
                <div className="p-3 rounded-xl bg-[#ff914d]/20 dark:bg-[#ff914d]/25 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    RESPIRATIONS
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].respiratory_rate || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">BREATHS/MIN</span>
                </div>

                {/* GCS */}
                <div className="p-3 rounded-xl bg-[#cc88ff]/25 dark:bg-[#cc88ff]/20 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    GLASGOW GCS
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].gcs ? `${vitals[0].gcs}/15` : '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">COMA SCORE</span>
                </div>

                {/* Glucose */}
                <div className="p-3 rounded-xl bg-[#00d2ff]/20 dark:bg-[#00d2ff]/25 border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-center">
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase font-mono block">
                    BLOOD GLUCOSE
                  </span>
                  <p className="text-xl font-black text-[#121826] dark:text-white mt-0.5 font-mono">
                    {vitals[0].blood_glucose || '—'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">mg/dL</span>
                </div>
              </div>
            </div>
          )}

          {/* Administered Medications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-[#00d2ff] stroke-[2.5]" />
                MEDICATIONS ADMINISTERED ({medications?.length || 0})
              </h3>
            </div>

            {medications && medications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {medications.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white dark:bg-[#1a2232] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm hover:shadow-neo transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-base font-extrabold text-[#121826] dark:text-white tracking-tight">
                          {m.name}
                        </h4>
                      </div>

                      {/* Dosage & Route Badges */}
                      <div className="flex flex-wrap items-center gap-2 my-2">
                        <span className="neo-badge bg-[#ffe600] text-black px-2 py-0.5 font-mono">
                          {m.dose ? `${m.dose} ${m.unit || ''}` : 'Standard Dose'}
                        </span>
                        <span className="neo-badge bg-slate-100 dark:bg-[#0f141d] text-slate-800 dark:text-slate-200 px-2 py-0.5 font-mono">
                          {m.route || 'IV Push'}
                        </span>
                      </div>

                      {/* Verbatim Spoken Term Tag */}
                      {m.raw_term && (
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-[#faf8f2] dark:bg-[#0f141d] px-2 py-1 rounded border border-slate-300 dark:border-slate-700 mt-2">
                          <b className="text-black dark:text-white">Spoken:</b> "{m.raw_term}"
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t-2 border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-black dark:text-white stroke-[2.5]" />
                        {m.relative_time_phrase || (m.timestamp ? m.timestamp.substring(11, 16) : 'On scene')}
                      </span>
                      {m.timestamp && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {m.timestamp.substring(11, 19)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 italic p-3.5 rounded-xl bg-[#faf8f2] dark:bg-[#0f141d] border-2 border-dashed border-slate-300 dark:border-slate-700">
                No medications administered during this encounter.
              </p>
            )}
          </div>

          {/* Procedures & Interventions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Syringe className="w-4 h-4 text-[#00e599] stroke-[2.5]" />
                PROCEDURES & INTERVENTIONS ({procedures?.length || 0})
              </h3>
            </div>

            {procedures && procedures.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {procedures.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white dark:bg-[#1a2232] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm hover:shadow-neo transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-base font-extrabold text-[#121826] dark:text-white tracking-tight flex items-center gap-1.5">
                          {p.name}
                          <CheckCircle2 className="w-4 h-4 text-[#00e599] stroke-[3]" />
                        </h4>
                        <span className="neo-badge bg-[#00e599] text-black px-1.5 py-0.5 text-[10px]">
                          {p.success ? 'Confirmed' : 'Attempted'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 my-2">
                        <p>
                          <b className="text-black dark:text-white">Site / Details:</b> {p.site || 'Standard anatomic site'}
                        </p>
                        {p.details && (
                          <p className="text-slate-600 dark:text-slate-400">
                            {p.details}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t-2 border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-black dark:text-white stroke-[2.5]" />
                        {p.relative_time_phrase || 'En route / Scene'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 italic p-3.5 rounded-xl bg-[#faf8f2] dark:bg-[#0f141d] border-2 border-dashed border-slate-300 dark:border-slate-700">
                No invasive procedures logged.
              </p>
            )}
          </div>

          {/* Objective Clinical Narrative */}
          {narrative_summary && (
            <div>
              <h3 className="text-xs font-black text-[#121826] dark:text-white uppercase tracking-wider mb-2">
                OBJECTIVE CLINICAL NARRATIVE
              </h3>
              <div className="p-4 rounded-xl bg-[#faf8f2] dark:bg-[#0f141d] border-2 border-[#121826] dark:border-[#2d3748] shadow-neo-sm text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                {narrative_summary}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
