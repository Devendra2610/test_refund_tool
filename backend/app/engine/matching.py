from sqlalchemy.orm import Session
from ..database import PurchaseRecord, Gstr2BRecord

def clean_inv_no(inv_no: str) -> str:
    if not inv_no:
        return ""
    # Convert to lowercase and strip all non-alphanumeric characters for robust matching
    return "".join(c for c in str(inv_no).lower() if c.isalnum())

def match_pr_to_2b(db: Session, application_id: int):
    # 1. Load Purchase records
    purchases = db.query(PurchaseRecord).filter(PurchaseRecord.application_id == application_id).all()
    
    # 2. Load GSTR-2B records
    gstr2b_records = db.query(Gstr2BRecord).filter(Gstr2BRecord.application_id == application_id).all()
    
    # Create lookup map
    # Key: (clean_gstin, clean_invoice_no)
    lookup_map = {}
    for r in gstr2b_records:
        gstin_clean = str(r.gstin_supplier).strip().upper()
        inv_clean = clean_inv_no(r.invoice_number)
        lookup_map[(gstin_clean, inv_clean)] = r
        # Also map by just invoice number as fallback for cases where GSTIN might be slightly off
        lookup_map[inv_clean] = r

    matched_count = 0
    for p in purchases:
        # Default flags
        p.is_matched_2b = False
        p.gstr_2b_month = None
        p.gstr_2b_sn = None
        
        # Handle special rows first
        if p.is_import:
            p.is_matched_2b = True
            p.gstr_2b_sn = "IMPS"
            # Import month defaults to purchase record's month
            p.gstr_2b_month = p.month
            matched_count += 1
            continue
            
        if p.is_rcm:
            p.is_matched_2b = True
            p.gstr_2b_sn = "RCM"
            p.gstr_2b_month = p.month
            matched_count += 1
            continue
            
        # Standard domestic matching
        gstin_clean = str(p.gstin_supplier).strip().upper()
        inv_clean = clean_inv_no(p.invoice_number)
        
        # Try exact (GSTIN, Invoice No) match first
        match = lookup_map.get((gstin_clean, inv_clean))
        if not match:
            # Try matching on invoice number alone
            match = lookup_map.get(inv_clean)
            
        if match:
            p.is_matched_2b = True
            p.gstr_2b_sn = match.sr_no
            p.gstr_2b_month = match.month
            matched_count += 1
            
    db.commit()
    return matched_count
