import pandas as pd
import datetime
from sqlalchemy.orm import Session
from ..database import PurchaseRecord

def parse_date(d):
    if pd.isna(d) or d == "":
        return None
    if isinstance(d, (int, float)):
        # Excel serial date
        try:
            return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(d))
        except:
            return None
    if isinstance(d, datetime.datetime):
        return d.date()
    if isinstance(d, datetime.date):
        return d
    # Try parsing string formats
    s = str(d).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d-%b-%Y", "%d-%b-%y", "%b-%y", "%B-%y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # Robust fallback using pandas
    try:
        return pd.to_datetime(s).date()
    except:
        pass
    return None

def clean_float(val):
    if pd.isna(val) or val == "":
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    # Strip currency signs and commas
    s = str(val).replace("₹", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

def process_and_save_pr(db: Session, application_id: int, df_raw: pd.DataFrame):
    # 1. Clean previous records for this application
    db.query(PurchaseRecord).filter(PurchaseRecord.application_id == application_id).delete(synchronize_session=False)
    db.commit()
    
    # 2. Map raw columns to standard fields
    # Standard field mapping list (flexible to common names)
    col_mapping = {
        "month": ["month", "period", "return period"],
        "gstin_supplier": ["gstin of supplier", "gstin of the supplier", "supplier gstin", "gstin"],
        "trade_name": ["trade/legal name", "trade/legal name of supplier", "supplier name", "trade name", "name of the supplier", "trade/legal name of the supplier"],
        "invoice_number": ["invoice number", "invoice no", "invoice no.", "document number", "doc no"],
        "invoice_date": ["invoice date", "invoice dt", "document date", "doc date"],
        "rate": ["rate(%)", "rate %", "tax rate", "rate"],
        "invoice_value": ["invoice value(₹)", "invoice value (inr)", "invoice value", "document value"],
        "taxable_value": ["taxable value (₹)", "taxable value (inr)", "taxable value", "taxable amount"],
        "igst": ["integrated tax(₹)", "igst(₹)", "integrated tax", "igst"],
        "cgst": ["central tax(₹)", "cgst(₹)", "central tax", "cgst"],
        "sgst": ["state/ut tax(₹)", "sgst(₹)", "state/ut tax", "sgst"],
        "hsn_code": ["hsn code", "hsn/sac", "hsn", "sac"],
        "description": ["description of service", "description", "nature of services"],
        "nature_of_purchase": ["nature of purchase", "category of inputs supplies", "inputs/inputs services/capital goods"],
        "eligibility": ["eligibility", "eligible for itc"]
    }
    
    # Standardise column names
    df = df_raw.copy()
    df.columns = df.columns.astype(str).str.strip().str.lower()
    
    final_mapping = {}
    for standard_col, options in col_mapping.items():
        found = False
        for opt in options:
            if opt.lower() in df.columns:
                final_mapping[standard_col] = opt.lower()
                found = True
                break
        if not found:
            # Try partial matching
            for col in df.columns:
                if any(opt.lower() in col for opt in options):
                    final_mapping[standard_col] = col
                    found = True
                    break
                    
    # Create Purchase records
    records_saved = 0
    for idx, row in df.iterrows():
        # Extrapolate values
        gstin = str(row.get(final_mapping.get("gstin_supplier"), "")).strip() if "gstin_supplier" in final_mapping else ""
        trade = str(row.get(final_mapping.get("trade_name"), "")).strip() if "trade_name" in final_mapping else ""
        inv_no = str(row.get(final_mapping.get("invoice_number"), "")).strip() if "invoice_number" in final_mapping else ""
        
        # Check if record has essential invoice info (skip rows that are summary/totals)
        if not inv_no or inv_no.lower() in ("total", "grand total", "nan", ""):
            continue
            
        inv_date = parse_date(row.get(final_mapping.get("invoice_date")))
        if not inv_date:
            continue
            
        rate = clean_float(row.get(final_mapping.get("rate"), 0.0))
        val = clean_float(row.get(final_mapping.get("invoice_value"), 0.0))
        taxable = clean_float(row.get(final_mapping.get("taxable_value"), 0.0))
        igst = clean_float(row.get(final_mapping.get("igst"), 0.0))
        cgst = clean_float(row.get(final_mapping.get("cgst"), 0.0))
        sgst = clean_float(row.get(final_mapping.get("sgst"), 0.0))
        
        # Auto-detect flags
        is_imps = (gstin.upper() == "IMPS") or ("imps" in trade.lower())
        is_rcm = (gstin.upper() == "RCM") or ("rcm" in trade.lower()) or (str(row.get("gstr 3b remarks", "")).lower() == "rcm")
        
        # Clean flags to match format
        if is_imps:
            gstin = "IMPS"
        elif is_rcm:
            gstin = "RCM"
            
        hsn = str(row.get(final_mapping.get("hsn_code"), "")).strip()
        desc = str(row.get(final_mapping.get("description"), "")).strip()
        elig = str(row.get(final_mapping.get("eligibility"), "Yes")).strip()
        
        # Add to DB
        rec = PurchaseRecord(
            application_id=application_id,
            month=str(row.get(final_mapping.get("month"), "")),
            gstin_supplier=gstin,
            trade_name=trade,
            invoice_number=inv_no,
            invoice_date=inv_date,
            rate=rate,
            invoice_value=val,
            taxable_value=taxable,
            igst=igst,
            cgst=cgst,
            sgst=sgst,
            total_tax=igst + cgst + sgst,
            hsn_code=hsn,
            description=desc,
            is_import=is_imps,
            is_rcm=is_rcm,
            eligibility=elig
        )
        db.add(rec)
        records_saved += 1
        
    db.commit()
    return records_saved
