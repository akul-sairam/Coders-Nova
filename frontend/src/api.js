/**
 * api.js - Client HTTP abstraction layer for Edge EMS AI Backend
 */

const API_BASE = '/api';

/**
 * Fetch edge system health and telemetry
 */
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return await res.json();
}

/**
 * Process typed paramedic clinical notes end-to-end
 */
export async function processClinicalText(text, encounterId = null, callSign = 'Medic 1') {
  const res = await fetch(`${API_BASE}/process-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      encounter_id: encounterId,
      call_sign: callSign
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to process clinical notes.');
  }
  return await res.json();
}

/**
 * Process recorded audio blob end-to-end (ASR -> SLM -> Normalizer -> Ledger)
 */
export async function processClinicalAudio(audioBlob, encounterId = null, callSign = 'Medic 1') {
  const formData = new FormData();
  formData.append('file', audioBlob, 'ems_audio.webm');
  if (encounterId) formData.append('encounter_id', encounterId);
  if (callSign) formData.append('call_sign', callSign);

  const res = await fetch(`${API_BASE}/process-audio`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Audio processing pipeline failed.');
  }
  return await res.json();
}

/**
 * Generate and download tamper-evident clinical handover PDF
 */
export async function downloadHandoverPDF(clinicalData, auditBlock, encounterId, callSign = 'Medic 1') {
  const res = await fetch(`${API_BASE}/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clinical_data: clinicalData,
      audit_block: auditBlock,
      encounter_id: encounterId,
      call_sign: callSign
    })
  });
  if (!res.ok) throw new Error('Failed to render PDF.');
  
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `handover_${encounterId}_block_${auditBlock.index}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  a.remove();
}

/**
 * Fetch local cryptographic ledger history
 */
export async function fetchLedger(limit = 20) {
  const res = await fetch(`${API_BASE}/ledger?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch audit ledger.');
  return await res.json();
}

/**
 * Run full cryptographic integrity verification on the SHA-256 chain
 */
export async function verifyLedgerChain() {
  const res = await fetch(`${API_BASE}/ledger/verify`);
  if (!res.ok) throw new Error('Ledger verification failed.');
  return await res.json();
}
