from sqlalchemy.orm import Session
from ..database import Invoice, FircRecord, ReconciliationDetail, RefundApplication

def reconcile_sales_firc(db: Session, application_id: int):
    # 1. Clear existing reconciliation details for this application
    db.query(ReconciliationDetail).filter(
        ReconciliationDetail.invoice_id.in_(
            db.query(Invoice.id).filter(Invoice.application_id == application_id)
        )
    ).delete(synchronize_session=False)
    
    # Reset statuses
    db.query(Invoice).filter(Invoice.application_id == application_id).update({
        "is_reconciled": False
    }, synchronize_session=False)
    
    db.query(FircRecord).filter(FircRecord.application_id == application_id).update({
        "remarks": "Not utilized",
        "remaining_amount_foreign": FircRecord.amount_foreign
    }, synchronize_session=False)
    
    db.commit()
    
    # 2. Load and sort invoices (Export - Without payment of tax)
    # Filter for exports, exclude flagged ones, and sort chronologically
    invoices = db.query(Invoice).filter(
        Invoice.application_id == application_id,
        Invoice.type_of_supply == "Export - Without payment of tax",
        Invoice.exclude_from_matching == False
    ).order_by(Invoice.invoice_date, Invoice.invoice_no).all()
    
    # 3. Load and sort FIRCs
    fircs = db.query(FircRecord).filter(
        FircRecord.application_id == application_id
    ).order_by(FircRecord.firc_date, FircRecord.firc_no).all()
    
    if not invoices or not fircs:
        return {"status": "success", "message": "No invoices or FIRCs to reconcile."}
        
    firc_idx = 0
    total_zrt = 0.0
    
    for inv in invoices:
        rem_inr = inv.taxable_value
        
        while rem_inr > 0.01 and firc_idx < len(fircs):
            firc = fircs[firc_idx]
            
            if firc.remaining_amount_foreign <= 0.0001:
                firc_idx += 1
                continue
                
            firc_rate = firc.rate if firc.rate else 1.0
            max_firc_inr = firc.remaining_amount_foreign * firc_rate
            
            if max_firc_inr >= rem_inr:
                # FIRC has enough balance to cover the remaining invoice INR
                fc_used = rem_inr / firc_rate
                
                detail = ReconciliationDetail(
                    invoice_id=inv.id,
                    firc_id=firc.id,
                    firc_amount_used_fc=fc_used,
                    rate_used=firc_rate,
                    collection_amount_inr=rem_inr
                )
                db.add(detail)
                
                firc.remaining_amount_foreign -= fc_used
                if firc.remaining_amount_foreign <= 0.005:
                    firc.remaining_amount_foreign = 0.0
                    firc.remarks = "Utilised"
                else:
                    firc.remarks = "Partially used"
                    
                total_zrt += rem_inr
                rem_inr = 0.0
                inv.is_reconciled = True
            else:
                # FIRC balance is fully consumed, invoice still has remaining value
                fc_used = firc.remaining_amount_foreign
                inr_collected = fc_used * firc_rate
                
                detail = ReconciliationDetail(
                    invoice_id=inv.id,
                    firc_id=firc.id,
                    firc_amount_used_fc=fc_used,
                    rate_used=firc_rate,
                    collection_amount_inr=inr_collected
                )
                db.add(detail)
                
                firc.remaining_amount_foreign = 0.0
                firc.remarks = "Utilised"
                total_zrt += inr_collected
                rem_inr -= inr_collected
                firc_idx += 1
                
        if rem_inr <= 0.01:
            inv.is_reconciled = True
            
    # Update application's zero rated turnover
    app = db.query(RefundApplication).filter(RefundApplication.id == application_id).first()
    if app:
        app.zero_rated_turnover = total_zrt
        app.status = "Reconciled"
        
    db.commit()
    return {
        "status": "success",
        "message": f"Successfully reconciled. Zero Rated Turnover: INR {total_zrt:,.2f}"
    }
