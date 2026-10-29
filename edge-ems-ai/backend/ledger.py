"""
ledger.py - SQLite-Backed SHA-256 Cryptographic Audit Ledger for Edge EMS AI

EDGE OPTIMIZATION & TAMPER-EVIDENT DESIGN:
1. Cryptographic Chaining (SHA-256):
   - Every clinical handover document is converted into canonical JSON (sorted keys,
     minimal delimiters) and hashed via SHA-256.
   - Each block embeds the hash of its preceding block (prev_hash). Modifying any past
     entry invalidates all subsequent block hashes, providing cryptographic non-repudiation
     and auditability in high-liability medical-legal settings.

2. Embedded SQLite Engine:
   - Uses zero-configuration embedded SQLite. Runs completely offline on local flash
     storage with WAL (Write-Ahead Logging) mode enabled for high concurrency and
     power-loss crash resilience on rugged edge hardware.

3. Canonical JSON Hashing:
   - Eliminates whitespace variability or key ordering drift across different JSON serializers,
     guaranteeing deterministic O(1) hash reproduction.
"""

import sqlite3
import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from schemas import AuditBlock, LedgerVerificationResult

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "ems_audit_ledger.db")


class CryptographicLedger:
    """
    Thread-safe cryptographic blockchain-style ledger stored in local SQLite.
    Guarantees tamper-evident audit trails for all emergency clinical handovers.
    """

    GENESIS_HASH = "0" * 64

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """
        Returns an optimized SQLite connection with WAL mode and foreign keys enabled.
        """
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Enable Write-Ahead Logging for speed and durability during power cutoffs
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self):
        """
        Initializes ledger schema and seals Genesis block if empty.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS audit_blocks (
                        block_index INTEGER PRIMARY KEY,
                        timestamp TEXT NOT NULL,
                        encounter_id TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        payload_hash TEXT NOT NULL,
                        prev_hash TEXT NOT NULL,
                        block_hash TEXT NOT NULL UNIQUE
                    );
                """)
                conn.commit()

                # Verify if Genesis block exists
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM audit_blocks;")
                count = cursor.fetchone()[0]

                if count == 0:
                    self._create_genesis_block(conn)
            finally:
                conn.close()

    def _create_genesis_block(self, conn: sqlite3.Connection):
        """
        Seals immutable Block #0 (Genesis) representing system installation and calibration.
        """
        ts = "2026-01-01T00:00:00Z"
        genesis_payload = {
            "system": "Edge EMS Clinical AI",
            "event": "GENESIS_INITIALIZATION",
            "author": "Antigravity Edge Kernel",
            "offline_crypto": "SHA-256"
        }
        payload_hash = self.calculate_canonical_hash(genesis_payload)
        block_hash = self._compute_block_hash(
            index=0,
            timestamp=ts,
            encounter_id="GENESIS",
            payload_hash=payload_hash,
            prev_hash=self.GENESIS_HASH
        )

        conn.execute("""
            INSERT INTO audit_blocks (
                block_index, timestamp, encounter_id, payload_json,
                payload_hash, prev_hash, block_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (
            0,
            ts,
            "GENESIS",
            json.dumps(genesis_payload, sort_keys=True),
            payload_hash,
            self.GENESIS_HASH,
            block_hash
        ))
        conn.commit()

    @staticmethod
    def calculate_canonical_hash(payload: Dict[str, Any]) -> str:
        """
        Computes SHA-256 over canonical JSON (deterministic key sorting, compact delimiters).
        """
        canonical_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    @staticmethod
    def _compute_block_hash(
        index: int,
        timestamp: str,
        encounter_id: str,
        payload_hash: str,
        prev_hash: str
    ) -> str:
        """
        Calculates cryptographic block seal hash chaining the current payload to the previous block.
        """
        header = f"{index}|{timestamp}|{encounter_id}|{payload_hash}|{prev_hash}"
        return hashlib.sha256(header.encode('utf-8')).hexdigest()

    def append_record(
        self,
        encounter_id: str,
        clinical_payload: Dict[str, Any],
        timestamp: Optional[str] = None
    ) -> AuditBlock:
        """
        Appends a new clinical handover entry into the cryptographic audit chain.
        Thread-safe and atomic.
        """
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        payload_hash = self.calculate_canonical_hash(clinical_payload)

        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT block_index, block_hash FROM audit_blocks
                    ORDER BY block_index DESC LIMIT 1;
                """)
                last_row = cursor.fetchone()

                last_index = last_row["block_index"]
                prev_hash = last_row["block_hash"]
                new_index = last_index + 1

                block_hash = self._compute_block_hash(
                    index=new_index,
                    timestamp=ts,
                    encounter_id=encounter_id,
                    payload_hash=payload_hash,
                    prev_hash=prev_hash
                )

                payload_json_str = json.dumps(clinical_payload, sort_keys=True)

                conn.execute("""
                    INSERT INTO audit_blocks (
                        block_index, timestamp, encounter_id, payload_json,
                        payload_hash, prev_hash, block_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """, (
                    new_index,
                    ts,
                    encounter_id,
                    payload_json_str,
                    payload_hash,
                    prev_hash,
                    block_hash
                ))
                conn.commit()

                return AuditBlock(
                    index=new_index,
                    timestamp=ts,
                    encounter_id=encounter_id,
                    payload_hash=payload_hash,
                    prev_hash=prev_hash,
                    block_hash=block_hash,
                    payload=clinical_payload
                )
            finally:
                conn.close()

    def get_latest_block(self) -> Optional[AuditBlock]:
        """
        Retrieves the most recent block in the cryptographic ledger.
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM audit_blocks ORDER BY block_index DESC LIMIT 1;
            """)
            row = cursor.fetchone()
            if not row:
                return None

            return AuditBlock(
                index=row["block_index"],
                timestamp=row["timestamp"],
                encounter_id=row["encounter_id"],
                payload_hash=row["payload_hash"],
                prev_hash=row["prev_hash"],
                block_hash=row["block_hash"],
                payload=json.loads(row["payload_json"])
            )
        finally:
            conn.close()

    def get_history(self, limit: int = 50) -> List[AuditBlock]:
        """
        Fetches the recent chain history for on-device audit inspection.
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM audit_blocks ORDER BY block_index DESC LIMIT ?;
            """, (limit,))
            rows = cursor.fetchall()

            history = []
            for row in rows:
                history.append(AuditBlock(
                    index=row["block_index"],
                    timestamp=row["timestamp"],
                    encounter_id=row["encounter_id"],
                    payload_hash=row["payload_hash"],
                    prev_hash=row["prev_hash"],
                    block_hash=row["block_hash"],
                    payload=json.loads(row["payload_json"])
                ))
            return history
        finally:
            conn.close()

    def verify_integrity(self) -> LedgerVerificationResult:
        """
        Audits entire cryptographic chain from Block 0 to N.
        Checks:
        1. prev_hash[i] == block_hash[i-1]
        2. payload_hash matches sha256(canonical(payload))
        3. block_hash matches sha256(index + ts + encounter + payload_hash + prev_hash)
        """
        conn = self._get_connection()
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_blocks ORDER BY block_index ASC;")
            rows = cursor.fetchall()

            if not rows:
                return LedgerVerificationResult(
                    is_valid=False,
                    total_blocks=0,
                    latest_block_hash="",
                    verified_at=now_iso,
                    message="Ledger is empty; no genesis block found."
                )

            expected_prev_hash = self.GENESIS_HASH
            for row in rows:
                idx = row["block_index"]
                ts = row["timestamp"]
                enc_id = row["encounter_id"]
                p_json = row["payload_json"]
                p_hash = row["payload_hash"]
                prev_h = row["prev_hash"]
                b_hash = row["block_hash"]

                # 1. Verify previous hash chaining
                if prev_h != expected_prev_hash:
                    return LedgerVerificationResult(
                        is_valid=False,
                        total_blocks=len(rows),
                        latest_block_hash=rows[-1]["block_hash"],
                        verified_at=now_iso,
                        broken_block_index=idx,
                        message=f"Broken chain at block #{idx}: prev_hash does not match preceding block_hash."
                    )

                # 2. Re-compute payload canonical hash
                payload_obj = json.loads(p_json)
                expected_p_hash = self.calculate_canonical_hash(payload_obj)
                if expected_p_hash != p_hash:
                    return LedgerVerificationResult(
                        is_valid=False,
                        total_blocks=len(rows),
                        latest_block_hash=rows[-1]["block_hash"],
                        verified_at=now_iso,
                        broken_block_index=idx,
                        message=f"Payload tampering detected at block #{idx}: data hash mismatch."
                    )

                # 3. Re-compute block header hash
                computed_b_hash = self._compute_block_hash(idx, ts, enc_id, p_hash, prev_h)
                if computed_b_hash != b_hash:
                    return LedgerVerificationResult(
                        is_valid=False,
                        total_blocks=len(rows),
                        latest_block_hash=rows[-1]["block_hash"],
                        verified_at=now_iso,
                        broken_block_index=idx,
                        message=f"Header seal tampering detected at block #{idx}: block_hash is invalid."
                    )

                expected_prev_hash = b_hash

            return LedgerVerificationResult(
                is_valid=True,
                total_blocks=len(rows),
                latest_block_hash=rows[-1]["block_hash"],
                verified_at=now_iso,
                message=f"All {len(rows)} blocks cryptographically verified and unbroken."
            )
        finally:
            conn.close()


# Global singleton instance for edge application
ledger_instance = CryptographicLedger()
